import type React from 'react';
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '@/contexts/AuthContext';
import { useBookmarksContext } from '@/contexts/BookmarkContext';
import { getBookmark } from '@/services/bookmarkService';
import { supabase } from '@/services/supabaseClient';
import { generateSummary, extractSmartTags } from '@/services/mlService';
import { TagInput } from '@/components/TagInput';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { SubscriptionBadge } from '@/components/SubscriptionBadge';
import { SubscriptionManager } from '@/components/SubscriptionManager';
import { ChatInput } from '@/components/ChatInput';
import { Drawer } from '@/components/Drawer';
import type { Bookmark, ChatMessage, NoteDocument, ChatSession } from '@/types/bookmark';
import type { TagSummary } from '@/types/tag';
import type { Subscription } from '@/types/subscription';
import { streamAnswerFromBookmarks, type RagMatch, type ConversationMessage } from '@/services/ragService';
import { composeNoteFromBookmarks, exportNoteToGoogleDocs } from '@/services/notesService';
import { listTags } from '@/services/tagService';
import { getUserSubscription } from '@/services/subscriptionService';
import { ApiError } from '@/services/apiClient';
import { chromeStorage } from '@/utils/chrome';

// Helper to transform text with citation patterns into React nodes
function transformTextWithCitations(text: string, citations?: RagMatch[]): React.ReactNode {
    if (!text.includes('[')) return text;

    const parts = text.split(/(\[\d+\])/g);
    if (parts.length === 1) return text;

    return parts.map((part, index) => {
        const match = part.match(/^\[(\d+)\]$/);
        if (match && citations) {
            const citationIndex = Number.parseInt(match[1], 10) - 1;
            const citation = citations[citationIndex];
            if (citation) {
                return (
                    <a
                        key={`cite-${index}-${citation.bookmark.id}`}
                        href={citation.bookmark.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-citation"
                    >
                        [{match[1]}]
                        <span className="citation-tooltip">{citation.bookmark.title}</span>
                    </a>
                );
            }
        }
        return part || null;
    });
}

// Component to render message content with inline citations
function MessageContent({ content, citations }: { content: string; citations?: RagMatch[] }) {
    // Create custom components that process citations in text nodes
    const components = useMemo(() => ({
        a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { node?: unknown }) => (
            <a href={href} {...props} target="_blank" rel="noreferrer">{children}</a>
        ),
        p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement> & { node?: unknown }) => {
            const processChildren = (child: React.ReactNode): React.ReactNode => {
                if (typeof child === 'string') {
                    return transformTextWithCitations(child, citations);
                }
                return child;
            };
            const processed = Array.isArray(children) ? children.map(processChildren) : processChildren(children);
            return <p {...props}>{processed}</p>;
        },
        li: ({ children, ...props }: React.LiHTMLAttributes<HTMLLIElement> & { node?: unknown }) => {
            const processChildren = (child: React.ReactNode): React.ReactNode => {
                if (typeof child === 'string') {
                    return transformTextWithCitations(child, citations);
                }
                return child;
            };
            const processed = Array.isArray(children) ? children.map(processChildren) : processChildren(children);
            return <li {...props}>{processed}</li>;
        },
        strong: ({ children, ...props }: React.HTMLAttributes<HTMLElement> & { node?: unknown }) => {
            const processChildren = (child: React.ReactNode): React.ReactNode => {
                if (typeof child === 'string') {
                    return transformTextWithCitations(child, citations);
                }
                return child;
            };
            const processed = Array.isArray(children) ? children.map(processChildren) : processChildren(children);
            return <strong {...props}>{processed}</strong>;
        },
        em: ({ children, ...props }: React.HTMLAttributes<HTMLElement> & { node?: unknown }) => {
            const processChildren = (child: React.ReactNode): React.ReactNode => {
                if (typeof child === 'string') {
                    return transformTextWithCitations(child, citations);
                }
                return child;
            };
            const processed = Array.isArray(children) ? children.map(processChildren) : processChildren(children);
            return <em {...props}>{processed}</em>;
        }
    }), [citations]);

    return (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {content}
        </ReactMarkdown>
    );
}

export default function DashboardApp() {
    const { user, login, logout, loading } = useAuth();
    const { bookmarks, save, remove } = useBookmarksContext();
    const { t } = useTranslation();

    // Navigation State
    const [activeTab, setActiveTab] = useState<'overview' | 'chat' | 'notes'>('overview');
    const [subscriptionDrawerOpen, setSubscriptionDrawerOpen] = useState(false);
    const [activeBookmarkId, setActiveBookmarkId] = useState<string | null>(null);
    const [detailedBookmark, setDetailedBookmark] = useState<Bookmark | null>(null);
    const [loadingContent, setLoadingContent] = useState(false);

    // Chat State
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [question, setQuestion] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [chatError, setChatError] = useState<string | null>(null);
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
    const [regeneratingMessageId, setRegeneratingMessageId] = useState<string | null>(null);

    // Feature State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [noteTitle, setNoteTitle] = useState('HyperMemo Notes');
    const [note, setNote] = useState<NoteDocument | null>(null);
    const [exporting, setExporting] = useState(false);
    const [citations, setCitations] = useState<RagMatch[]>([]);
    const [isRegeneratingTags, setIsRegeneratingTags] = useState(false);
    const [isRegeneratingSummary, setIsRegeneratingSummary] = useState(false);
    const [isRefetchingContent, setIsRefetchingContent] = useState(false);
    const [selectedTag, setSelectedTag] = useState<string | null>(null);

    // Subscription State
    const [subscription, setSubscription] = useState<Subscription | null>(null);

    // Chat Tag State
    const [chatTags, setChatTags] = useState<string[]>([]);
    const [showTagSuggestions, setShowTagSuggestions] = useState(false);
    const [tagSearch, setTagSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const chatInputRef = useRef<HTMLTextAreaElement>(null);
    const bookmarkSignatureRef = useRef<string | null>(null);

    // Tag Data
    const [tagSummaries, setTagSummaries] = useState<TagSummary[]>([]);
    const [loadingTags, setLoadingTags] = useState(false);

    const refreshTags = useCallback(async () => {
        if (!user) {
            setTagSummaries([]);
            return;
        }
        try {
            setLoadingTags(true);
            const data = await listTags();
            setTagSummaries(data);
        } catch (error) {
            console.error('Failed to load tags', error);
        } finally {
            setLoadingTags(false);
        }
    }, [user]);

    useEffect(() => {
        if (!user) {
            setTagSummaries([]);
            bookmarkSignatureRef.current = null;
            return;
        }
        const signature = bookmarks.map(bookmark => `${bookmark.id}:${(bookmark.tags || []).join(',')}`).join('|');
        if (bookmarkSignatureRef.current === signature) {
            return;
        }
        bookmarkSignatureRef.current = signature;
        void refreshTags();
    }, [user, bookmarks, refreshTags]);

    // Modal State
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        isDangerous?: boolean;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        isDangerous: false
    });

    // Profile Menu State
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement>(null);

    // Close profile menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
                setIsProfileMenuOpen(false);
            }
        };

        if (isProfileMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isProfileMenuOpen]);

    const openConfirm = (title: string, message: string, onConfirm: () => void, isDangerous = false) => {
        setModalConfig({
            isOpen: true,
            title,
            message,
            onConfirm,
            isDangerous
        });
    };

    const closeConfirm = () => {
        setModalConfig(prev => ({ ...prev, isOpen: false }));
    };

    const activeBookmark = useMemo(
        () => bookmarks.find((b) => b.id === activeBookmarkId),
        [bookmarks, activeBookmarkId]
    );

    const selectedBookmarks = useMemo(
        () => bookmarks.filter((bookmark) => selectedIds.includes(bookmark.id)),
        [bookmarks, selectedIds]
    );

    const filteredBookmarks = useMemo(() => {
        if (!selectedTag) return bookmarks;
        return bookmarks.filter(b => b.tags?.includes(selectedTag));
    }, [bookmarks, selectedTag]);

    const activeSession = useMemo(
        () => sessions.find(s => s.id === activeSessionId) || null,
        [sessions, activeSessionId]
    );

    const messages = activeSession?.messages || [];

    // Check if user has Pro subscription
    const isPro = useMemo(() => {
        return subscription?.tier === 'pro' &&
            subscription?.status === 'active' &&
            new Date(subscription.endDate) > new Date();
    }, [subscription]);

    const availableTags = useMemo(() => {
        if (tagSummaries.length > 0) {
            return [...tagSummaries].sort((a, b) => a.name.localeCompare(b.name));
        }

        const counts = new Map<string, number>();
        for (const bookmark of bookmarks) {
            if (!bookmark.tags) continue;
            for (const name of bookmark.tags) {
                if (!name) continue;
                counts.set(name, (counts.get(name) ?? 0) + 1);
            }
        }

        return Array.from(counts.entries())
            .map(([name, bookmarkCount]) => ({
                id: name,
                name,
                bookmarkCount
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [tagSummaries, bookmarks]);

    const tagNames = useMemo(() => availableTags.map(tag => tag.name), [availableTags]);

    const filteredTags = useMemo(() => {
        if (!tagSearch) return tagNames;
        return tagNames.filter(t => t.toLowerCase().includes(tagSearch.toLowerCase()));
    }, [tagNames, tagSearch]);

    // Load chat sessions on mount
    useEffect(() => {
        const loadSessions = async () => {
            const savedSessions = await chromeStorage.get<ChatSession[]>('chat_sessions', []);
            const lastActiveId = await chromeStorage.get<string | null>('active_session_id', null);

            if (savedSessions.length > 0) {
                setSessions(savedSessions);
                // Restore last active session or default to the first one (most recent usually)
                if (lastActiveId && savedSessions.find(s => s.id === lastActiveId)) {
                    setActiveSessionId(lastActiveId);
                } else {
                    setActiveSessionId(savedSessions[0].id);
                }
            } else {
                // Create initial session if none exist
                createNewSession(savedSessions);
            }
        };
        loadSessions();
    }, []);

    // Save sessions whenever they change (debounced)
    useEffect(() => {
        if (sessions.length > 0) {
            const timeoutId = setTimeout(() => {
                chromeStorage.set('chat_sessions', sessions);
            }, 500); // Debounce by 500ms to reduce storage writes
            return () => clearTimeout(timeoutId);
        }
    }, [sessions]);

    // Save active session ID (debounced)
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            chromeStorage.set('active_session_id', activeSessionId);
        }, 300); // Shorter debounce for session switching
        return () => clearTimeout(timeoutId);
    }, [activeSessionId]);

    // Load user subscription
    useEffect(() => {
        const loadSubscription = async () => {
            if (user) {
                const sub = await getUserSubscription();
                setSubscription(sub);
            }
        };
        loadSubscription();
    }, [user]);

    const createNewSession = (currentSessions: ChatSession[] = sessions) => {
        const newSession: ChatSession = {
            id: crypto.randomUUID(),
            title: 'New Chat',
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        const updatedSessions = [newSession, ...currentSessions];
        setSessions(updatedSessions);
        setActiveSessionId(newSession.id);
        return newSession;
    };

    const deleteSession = (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        openConfirm(
            t('sidebar.deleteChat'),
            'Delete this chat?',
            async () => {
                // Optimistic update - update UI immediately
                const updatedSessions = sessions.filter(s => s.id !== sessionId);
                setSessions(updatedSessions);

                if (activeSessionId === sessionId) {
                    if (updatedSessions.length > 0) {
                        setActiveSessionId(updatedSessions[0].id);
                    } else {
                        createNewSession(updatedSessions);
                    }
                }

                // Save to storage in background
                chromeStorage.set('chat_sessions', updatedSessions).catch(error => {
                    console.error('Failed to save chat sessions', error);
                });
            },
            true
        );
    };

    // Handlers
    const handleLandingPageSearch = async () => {
        if (!question.trim()) return;

        if (!isPro) {
            openConfirm(
                t('subscription.upgradeTitle'),
                t('subscription.prompts.chat'),
                () => setSubscriptionDrawerOpen(true)
            );
            return;
        }

        // Create a new session for the landing page search
        const newSession: ChatSession = {
            id: crypto.randomUUID(),
            title: 'New Chat',
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        setActiveSessionId(newSession.id);
        setActiveTab('chat');
        await askAssistant(newSession);
    };

    const handleBookmarkClick = async (id: string) => {
        setActiveBookmarkId(id);
        setActiveTab('overview');

        const cacheKey = `bookmark_detail_${id}`;
        const cached = localStorage.getItem(cacheKey);
        let hasCached = false;

        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                setDetailedBookmark(parsed);
                hasCached = true;
            } catch (e) {
                console.error("Failed to parse cached bookmark", e);
            }
        }

        if (!hasCached) {
            setLoadingContent(true);
            setDetailedBookmark(null);
        }

        try {
            const fullBookmark = await getBookmark(id);
            setDetailedBookmark(fullBookmark);

            try {
                localStorage.setItem(cacheKey, JSON.stringify(fullBookmark));
            } catch (e) {
                console.warn("Failed to cache bookmark", e);
            }

            // Auto-generation is now handled by the backend

        } catch (error) {
            console.error('Failed to fetch full bookmark content', error);
        } finally {
            setLoadingContent(false);
        }
    };

    const handleDelete = () => {
        if (!activeBookmarkId) return;

        const bookmarkToDelete = bookmarks.find(b => b.id === activeBookmarkId);
        if (!bookmarkToDelete) return;

        const confirmMessage = `Are you sure you want to delete this bookmark?\n\n"${bookmarkToDelete.title || 'Untitled'}"`;

        openConfirm(
            t('dashboard.deleteBookmark'),
            confirmMessage,
            async () => {
                const bookmarkIdToDelete = activeBookmarkId;

                // Optimistic update - clear UI immediately
                setActiveBookmarkId(null);
                setDetailedBookmark(null);

                try {
                    // Delete in background
                    await remove(bookmarkIdToDelete);
                    await refreshTags();
                } catch (error) {
                    console.error('Failed to delete bookmark', error);
                    // Could restore the bookmark here if needed
                }
            },
            true
        );
    };

    const handleUpdateTags = async (newTags: string[]) => {
        if (!activeBookmark) return;

        // Optimistic update - update UI immediately
        const previousBookmark = activeBookmark;
        const optimisticBookmark = { ...activeBookmark, tags: newTags };

        // Update the bookmark in the local state immediately for smooth UX
        if (detailedBookmark) {
            setDetailedBookmark({ ...detailedBookmark, tags: newTags });
        }

        try {
            // Save to backend in the background
            await save(optimisticBookmark);
            await refreshTags();
        } catch (error) {
            // Revert on error
            console.error('Failed to update tags', error);
            if (detailedBookmark) {
                setDetailedBookmark({ ...detailedBookmark, tags: previousBookmark.tags || [] });
            }
        }
    };

    const handleRegenerateTags = async () => {
        if (!isPro) {
            openConfirm(
                t('subscription.upgradeTitle'),
                t('subscription.prompts.autoTag'),
                () => setSubscriptionDrawerOpen(true)
            );
            return;
        }
        if (!activeBookmark || !detailedBookmark) return;
        setIsRegeneratingTags(true);
        try {
            const tags = await extractSmartTags({
                content: detailedBookmark.rawContent || detailedBookmark.summary,
                title: activeBookmark.title,
                url: activeBookmark.url
            });
            await save({ ...activeBookmark, tags });
            await refreshTags();
        } catch (error) {
            console.error('Failed to regenerate tags', error);
        } finally {
            setIsRegeneratingTags(false);
        }
    };

    const handleRegenerateSummary = async () => {
        if (!isPro) {
            openConfirm(
                t('subscription.upgradeTitle'),
                t('subscription.prompts.aiSummary'),
                () => setSubscriptionDrawerOpen(true)
            );
            return;
        }
        if (!activeBookmark || !detailedBookmark) return;
        setIsRegeneratingSummary(true);
        try {
            const summary = await generateSummary({
                content: detailedBookmark.rawContent,
                title: activeBookmark.title,
                url: activeBookmark.url
            });
            await save({ ...activeBookmark, summary });
        } catch (error) {
            console.error('Failed to regenerate summary', error);
        } finally {
            setIsRegeneratingSummary(false);
        }
    };

    const handleChatInputChange = (value: string) => {
        setQuestion(value);

        const lastWord = value.split(' ').pop();
        if (lastWord?.startsWith('@')) {
            setShowTagSuggestions(true);
            setTagSearch(lastWord.slice(1));
            setSelectedIndex(0);
        } else {
            setShowTagSuggestions(false);
        }
    };

    const handleTagSelect = (tag: string) => {
        if (!chatTags.includes(tag)) {
            setChatTags([...chatTags, tag]);
        }

        // Remove the @search part from the question
        const words = question.split(' ');
        words.pop(); // Remove the last word (which is the @tag)
        setQuestion(`${words.join(' ')} `); // Add space for next typing

        setShowTagSuggestions(false);
        setTagSearch('');
        setSelectedIndex(0);
    };

    const handleRemoveChatTag = (tag: string) => {
        setChatTags(chatTags.filter(t => t !== tag));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, onSubmit?: () => void) => {
        if (showTagSuggestions && filteredTags.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev + 1) % filteredTags.length);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev - 1 + filteredTags.length) % filteredTags.length);
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                handleTagSelect(filteredTags[selectedIndex]);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setShowTagSuggestions(false);
                return;
            }
        }

        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (onSubmit) {
                onSubmit();
            } else {
                askAssistant();
            }
        }
    };

    const [isChatHistoryOpen, setIsChatHistoryOpen] = useState(true);

    const handleResetSession = () => {
        if (!activeSessionId) return;
        openConfirm(
            t('sidebar.resetChat'),
            'Clear all messages in this chat?',
            async () => {
                const updatedSessions = sessions.map(s =>
                    s.id === activeSessionId
                        ? { ...s, messages: [], updatedAt: new Date().toISOString() }
                        : s
                );
                setSessions(updatedSessions);
                await chromeStorage.set('chat_sessions', updatedSessions);
            },
            true
        );
    };

    const handleCopyMessage = async (messageId: string, content: string) => {
        try {
            await navigator.clipboard.writeText(content);
            setCopiedMessageId(messageId);
            setTimeout(() => setCopiedMessageId(null), 2000);
        } catch (error) {
            console.error('Failed to copy message', error);
        }
    };

    const handleRegenerateResponse = async (messageIndex: number) => {
        if (!activeSessionId || regeneratingMessageId || chatLoading) return;

        const session = sessions.find(s => s.id === activeSessionId);
        if (!session || messageIndex < 1) return;

        // Get the user message before the assistant message
        const userMessage = session.messages[messageIndex - 1];
        if (!userMessage || userMessage.role !== 'user') return;

        setRegeneratingMessageId(session.messages[messageIndex].id);
        setChatLoading(true);
        setChatError(null);

        // Remove the assistant message we're regenerating and add a new placeholder
        const updatedMessages = session.messages.slice(0, messageIndex);
        const assistantMessageId = crypto.randomUUID();
        const assistantMessage: ChatMessage = {
            id: assistantMessageId,
            role: 'assistant',
            content: '',
            createdAt: new Date().toISOString(),
            citations: []
        };

        setSessions(prevSessions => prevSessions.map(s =>
            s.id === activeSessionId
                ? { ...s, messages: [...updatedMessages, assistantMessage], updatedAt: new Date().toISOString() }
                : s
        ));

        // Get conversation history up to (but not including) the message being regenerated
        const conversationHistory: ConversationMessage[] = session.messages
            .slice(0, messageIndex - 1) // Exclude the user message that triggered this response
            .filter(msg => msg.role === 'user' || msg.role === 'assistant')
            .map(msg => ({
                role: msg.role as 'user' | 'assistant',
                content: msg.content
            }));

        try {
            let streamedContent = '';
            let matches: RagMatch[] = [];

            for await (const event of streamAnswerFromBookmarks(userMessage.content, chatTags, conversationHistory)) {
                if (event.type === 'matches') {
                    matches = event.matches;
                    setCitations(matches);
                    setSessions(prevSessions => prevSessions.map(s =>
                        s.id === activeSessionId
                            ? {
                                ...s,
                                messages: s.messages.map(m =>
                                    m.id === assistantMessageId
                                        ? { ...m, citations: matches }
                                        : m
                                ),
                                updatedAt: new Date().toISOString()
                            }
                            : s
                    ));
                } else if (event.type === 'content') {
                    streamedContent += event.content;
                    setSessions(prevSessions => prevSessions.map(s =>
                        s.id === activeSessionId
                            ? {
                                ...s,
                                messages: s.messages.map(m =>
                                    m.id === assistantMessageId
                                        ? { ...m, content: streamedContent }
                                        : m
                                ),
                                updatedAt: new Date().toISOString()
                            }
                            : s
                    ));
                } else if (event.type === 'error') {
                    throw new Error(event.error);
                }
            }
        } catch (error) {
            console.error('Failed to regenerate response', error);
            setChatError('Failed to regenerate response. Please try again.');
            // Restore the original messages on error
            setSessions(prevSessions => prevSessions.map(s =>
                s.id === activeSessionId
                    ? { ...s, messages: session.messages, updatedAt: new Date().toISOString() }
                    : s
            ));
        } finally {
            setRegeneratingMessageId(null);
            setChatLoading(false);
        }
    };

    const askAssistant = async (forcedSession?: ChatSession) => {
        const targetSessionId = forcedSession?.id || activeSessionId;
        if (!question.trim() || !targetSessionId) return;

        const currentQuestion = question;
        setQuestion('');
        if (chatInputRef.current) {
            chatInputRef.current.style.height = 'auto';
        }

        setChatLoading(true);
        setChatError(null);

        // Get current session's messages for conversation history (exclude system messages)
        const currentSession = forcedSession || sessions.find(s => s.id === targetSessionId);
        const conversationHistory: ConversationMessage[] = (currentSession?.messages || [])
            .filter(msg => msg.role === 'user' || msg.role === 'assistant')
            .map(msg => ({
                role: msg.role as 'user' | 'assistant',
                content: msg.content
            }));

        const userMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: currentQuestion,
            createdAt: new Date().toISOString()
        };

        // Create a placeholder assistant message for streaming
        const assistantMessageId = crypto.randomUUID();
        const assistantMessage: ChatMessage = {
            id: assistantMessageId,
            role: 'assistant',
            content: '',
            createdAt: new Date().toISOString(),
            citations: []
        };

        // Add both user message and placeholder assistant message in one update
        setSessions(prevSessions => {
            let currentSessions = prevSessions;
            // If a forced session is provided and not in the list, prepend it
            if (forcedSession && !currentSessions.find(s => s.id === forcedSession.id)) {
                currentSessions = [forcedSession, ...currentSessions];
            }

            const updatedSessions = currentSessions.map(s => {
                if (s.id === targetSessionId) {
                    // Update title if it's the first message
                    const title = s.messages.length === 0 ? currentQuestion.slice(0, 30) + (currentQuestion.length > 30 ? '...' : '') : s.title;
                    return {
                        ...s,
                        title,
                        messages: [...s.messages, userMessage, assistantMessage],
                        updatedAt: new Date().toISOString()
                    };
                }
                return s;
            });

            // Move active session to top
            const activeSessionIndex = updatedSessions.findIndex(s => s.id === targetSessionId);
            if (activeSessionIndex > 0) {
                const session = updatedSessions[activeSessionIndex];
                updatedSessions.splice(activeSessionIndex, 1);
                updatedSessions.unshift(session);
            }

            return updatedSessions;
        });

        try {
            let streamedContent = '';
            let matches: RagMatch[] = [];

            for await (const event of streamAnswerFromBookmarks(currentQuestion, chatTags, conversationHistory)) {
                if (event.type === 'matches') {
                    matches = event.matches;
                    setCitations(matches);
                    // Update citations in the message
                    setSessions(prevSessions => prevSessions.map(s =>
                        s.id === targetSessionId
                            ? {
                                ...s,
                                messages: s.messages.map(m =>
                                    m.id === assistantMessageId
                                        ? { ...m, citations: matches }
                                        : m
                                ),
                                updatedAt: new Date().toISOString()
                            }
                            : s
                    ));
                } else if (event.type === 'content') {
                    streamedContent += event.content;
                    // Update the content progressively
                    setSessions(prevSessions => prevSessions.map(s =>
                        s.id === targetSessionId
                            ? {
                                ...s,
                                messages: s.messages.map(m =>
                                    m.id === assistantMessageId
                                        ? { ...m, content: streamedContent }
                                        : m
                                ),
                                updatedAt: new Date().toISOString()
                            }
                            : s
                    ));
                } else if (event.type === 'error') {
                    throw new Error(event.error);
                }
            }
        } catch (error) {
            console.error('Failed to query RAG backend', error);
            setChatError('Failed to get answer. Please try again.');
            // Remove the failed assistant message
            setSessions(prevSessions => prevSessions.map(s =>
                s.id === targetSessionId
                    ? {
                        ...s,
                        messages: s.messages.filter(m => m.id !== assistantMessageId),
                        updatedAt: new Date().toISOString()
                    }
                    : s
            ));
        } finally {
            setChatLoading(false);
        }
    };

    const toggleBookmarkSelection = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        );
    };

    const buildNote = async () => {
        if (!selectedBookmarks.length) return;
        const draft = await composeNoteFromBookmarks(noteTitle, selectedBookmarks);
        setNote(draft);
    };

    const handleRefetchContent = async () => {
        if (!activeBookmarkId) return;

        setIsRefetchingContent(true);
        try {
            const { error } = await supabase.functions.invoke('process-bookmark', {
                body: { bookmark_id: activeBookmarkId }
            });

            if (error) throw error;

            // Refresh the detailed view
            const fullBookmark = await getBookmark(activeBookmarkId);
            setDetailedBookmark(fullBookmark);
        } catch (error) {
            console.error('Failed to refetch content:', error);
        } finally {
            setIsRefetchingContent(false);
        }
    };

    const exportNote = async () => {
        if (!note) return;
        setExporting(true);
        const exported = await exportNoteToGoogleDocs(note);
        setNote(exported);
        setExporting(false);
    };

    if (loading) {
        return (
            <div className="dashboard dashboard--loading">
                <p>{t('app.loading')}</p>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="dashboard dashboard--auth">
                <div className="dashboard__auth-card">
                    <div className="auth-logo">
                        <img src="/icons/icon-128.png" alt="HyperMemo" />
                    </div>
                    <h1>{t('app.signInTitle')}</h1>
                    <p>{t('app.signInDesc')}</p>
                    <button type="button" className="btn-google" onClick={login}>
                        <svg width="18" height="18" viewBox="0 0 24 24">
                            <title>Google</title>
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        {t('app.signInGoogle')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard">
            {/* Left Sidebar - Always Bookmarks */}
            <aside className="sidebar">
                <div className="sidebar__header">
                    <div className="flex-center" style={{ gap: '0.75rem' }}>
                        <img src="/icons/icon-48.png" alt="HyperMemo" style={{ width: 32, height: 32 }} />
                        <h1 style={{ fontSize: '1.25rem', letterSpacing: '-0.025em' }}>{t('app.name')}</h1>
                    </div>
                </div>
                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
                    <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('sidebar.myLibrary')}</span>
                        <span className="badge badge-subtle">{filteredBookmarks.length}</span>
                    </div>
                    <select
                        value={selectedTag || ''}
                        onChange={(e) => setSelectedTag(e.target.value || null)}
                        style={{
                            width: '100%',
                            padding: '0.375rem',
                            fontSize: '0.8rem',
                            borderRadius: '0.375rem',
                            border: '1px solid var(--border)',
                            background: 'var(--bg-main)',
                            color: 'var(--text-primary)',
                            outline: 'none'
                        }}
                        disabled={loadingTags && availableTags.length === 0}
                    >
                        <option value="">{t('sidebar.allTags')}</option>
                        {availableTags.map(tag => (
                            <option key={tag.id} value={tag.name}>
                                {tag.bookmarkCount !== undefined ? `${tag.name} (${tag.bookmarkCount})` : tag.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="sidebar__list">
                    {filteredBookmarks.map((bookmark) => (
                        <div
                            key={bookmark.id}
                            className={`nav-item ${activeBookmarkId === bookmark.id ? 'active' : ''}`}
                            onClick={() => handleBookmarkClick(bookmark.id)}
                            // biome-ignore lint/a11y/useSemanticElements: Nested interactive elements require div
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    handleBookmarkClick(bookmark.id);
                                }
                            }}
                        >
                            <h3>{bookmark.title || t('dashboard.untitled')}</h3>
                            <div className="flex-between">
                                <p>{new URL(bookmark.url).hostname}</p>
                                {activeTab === 'notes' && (
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.includes(bookmark.id)}
                                        onClick={(e) => toggleBookmarkSelection(e, bookmark.id)}
                                        onChange={() => { }}
                                    />
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </aside>

            {/* Main Content */}
            <main className="main">
                <header className="main__header">
                    <div className="tabs">
                        <button
                            type="button"
                            className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
                            onClick={() => setActiveTab('overview')}
                        >
                            {t('sidebar.bookmarks')}
                        </button>
                        <button
                            type="button"
                            className={`tab ${activeTab === 'chat' ? 'active' : ''}`}
                            onClick={() => setActiveTab('chat')}
                        >
                            {t('sidebar.chat')}
                            <span className="tab-badge tab-badge--pro">
                                <span className="tab-badge__icon">✨</span>
                                <span className="tab-badge__text">AI</span>
                            </span>
                        </button>
                        <button
                            type="button"
                            className="tab"
                            disabled
                        >
                            {t('sidebar.notes')}
                            <span className="tab-badge tab-badge--subtle">{t('tabs.comingSoon')}</span>
                        </button>
                    </div>
                    <div className="flex-center">
                        {activeTab === 'chat' && (
                            <button
                                type="button"
                                className="btn-icon"
                                onClick={() => setIsChatHistoryOpen(!isChatHistoryOpen)}
                                title={isChatHistoryOpen ? "Collapse History" : "Open History"}
                                style={{
                                    color: isChatHistoryOpen ? 'var(--primary)' : 'var(--text-secondary)',
                                    background: isChatHistoryOpen ? 'var(--bg-active)' : 'transparent',
                                    marginRight: '0.5rem'
                                }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <title>{isChatHistoryOpen ? "Collapse History" : "Open History"}</title>
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                    <line x1="15" y1="3" x2="15" y2="21" />
                                </svg>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setSubscriptionDrawerOpen(true)}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                        >
                            <SubscriptionBadge subscription={subscription} />
                        </button>
                        <div className="profile-menu-container" ref={profileMenuRef}>
                            <button
                                type="button"
                                className="profile-button"
                                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                                title={user.email || 'Profile'}
                            >
                                {user.user_metadata?.avatar_url || user.user_metadata?.picture ? (
                                    <img
                                        src={user.user_metadata.avatar_url || user.user_metadata.picture}
                                        alt={user.email || 'User'}
                                        className="user-avatar"
                                    />
                                ) : (
                                    <div className="user-avatar-placeholder">
                                        {user.email?.charAt(0).toUpperCase() || 'U'}
                                    </div>
                                )}
                            </button>
                            {isProfileMenuOpen && (
                                <div className="profile-dropdown">
                                    <div className="profile-dropdown-header">
                                        <div className="profile-dropdown-email">{user.email}</div>
                                    </div>
                                    <div className="profile-dropdown-divider" />
                                    <button
                                        type="button"
                                        className="profile-dropdown-item"
                                        onClick={() => {
                                            setIsProfileMenuOpen(false);
                                            logout();
                                        }}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <title>Sign Out</title>
                                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                            <polyline points="16 17 21 12 16 7" />
                                            <line x1="21" y1="12" x2="9" y2="12" />
                                        </svg>
                                        {t('app.signOut')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <div className="main__content">
                    {activeTab === 'overview' && (
                        activeBookmark ? (
                            <div className="detail-view">
                                <header className="detail-header">
                                    <div className="flex-between" style={{ alignItems: 'flex-start', gap: '1rem' }}>
                                        <h1 className="detail-title">{activeBookmark.title}</h1>
                                        <div className="detail-actions">
                                            <button
                                                type="button"
                                                className="btn-icon danger"
                                                onClick={handleDelete}
                                                title={t('dashboard.deleteBookmark')}
                                            >
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><title>{t('dashboard.deleteBookmark')}</title><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="detail-meta">
                                        <a href={activeBookmark.url} target="_blank" rel="noreferrer" className="link-primary flex-center" style={{ gap: '0.5rem' }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><title>{t('dashboard.externalLink')}</title><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                                            {new URL(activeBookmark.url).hostname}
                                        </a>
                                        <span>•</span>
                                        <span>{new Date(activeBookmark.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </header>

                                {/* Tags Section */}
                                <section className="detail-tags">
                                    <div className="detail-tags-header">
                                        <span className="detail-tags-label">{t('popup.fieldTags')}</span>
                                        <button
                                            type="button"
                                            className="btn-icon"
                                            onClick={handleRegenerateTags}
                                            disabled={isRegeneratingTags}
                                            title={t('dashboard.autoTag')}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <title>{t('dashboard.autoTag')}</title>
                                                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 21h5v-5" />
                                            </svg>
                                        </button>
                                    </div>
                                    <TagInput
                                        value={activeBookmark.tags || []}
                                        onChange={handleUpdateTags}
                                        placeholder={t('dashboard.addTags')}
                                    />
                                </section>

                                {/* AI Summary Section */}
                                <section className="summary-card">
                                    <div className="section-header">
                                        <div className="flex-center" style={{ gap: '0.5rem' }}>
                                            <h2 className="section-title">{t('dashboard.summary')}</h2>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn-icon"
                                            onClick={handleRegenerateSummary}
                                            disabled={isRegeneratingSummary}
                                            title={t('dashboard.regenerate')}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <title>{t('dashboard.regenerate')}</title>
                                                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 21h5v-5" />
                                            </svg>
                                        </button>
                                    </div>
                                    <div className="summary-content markdown-body">
                                        {isRegeneratingSummary ? (
                                            <div className="typing-indicator">
                                                <span /><span /><span />
                                            </div>
                                        ) : (
                                            <ReactMarkdown>
                                                {detailedBookmark?.summary || activeBookmark.summary || t('dashboard.noContent')}
                                            </ReactMarkdown>
                                        )}
                                    </div>
                                </section>

                                {/* Original Content Section */}
                                <section className="content-section">
                                    <div className="section-header">
                                        <h2 className="section-title">Original Content</h2>
                                        <button
                                            type="button"
                                            className="btn-icon"
                                            onClick={handleRefetchContent}
                                            disabled={isRefetchingContent || !activeBookmark}
                                            title="Refetch content from URL"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <title>Refetch Content</title>
                                                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 21h5v-5" />
                                            </svg>
                                        </button>
                                    </div>
                                    <div className="markdown-body content-body">
                                        {loadingContent || isRefetchingContent ? (
                                            <div className="flex-center" style={{ padding: '2rem', color: 'var(--text-secondary)' }}>
                                                <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <title>Loading Content</title>
                                                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                                </svg>
                                            </div>
                                        ) : (
                                            detailedBookmark?.rawContent ? (
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        a: ({ node, ...props }) => <a target="_blank" rel="noopener noreferrer" {...props} />
                                                    }}
                                                >
                                                    {detailedBookmark.rawContent}
                                                </ReactMarkdown>
                                            ) : (
                                                <div className="text-subtle italic">
                                                    {detailedBookmark ? 'No original content captured for this bookmark.' : 'Select a bookmark to view content.'}
                                                </div>
                                            )
                                        )}
                                    </div>
                                </section>
                            </div>
                        ) : (
                            <div className="empty-state">
                                <div className="flex-center" style={{ flexDirection: 'column', gap: '1.5rem', opacity: 0.8, maxWidth: '600px', width: '100%', margin: '0 auto' }}>
                                    <img src="/icons/icon-128.png" alt="HyperMemo" style={{ width: 80, height: 80 }} />
                                    <div style={{ textAlign: 'center' }}>
                                        <h1 style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.025em', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>{t('app.name')}</h1>
                                        <p style={{ fontSize: '1.125rem', color: 'var(--text-secondary)', margin: 0 }}>{t('app.slogan')}</p>
                                    </div>

                                    <div className="landing-search" style={{ width: '100%', position: 'relative' }}>
                                        <ChatInput
                                            value={question}
                                            onChange={handleChatInputChange}
                                            onSend={handleLandingPageSearch}
                                            onKeyDown={(e) => handleKeyDown(e, handleLandingPageSearch)}
                                            placeholder={t('dashboard.searchPlaceholder')}
                                            tags={chatTags}
                                            onRemoveTag={handleRemoveChatTag}
                                            showTagSuggestions={showTagSuggestions}
                                            filteredTags={filteredTags}
                                            selectedTagIndex={selectedIndex}
                                            onTagSelect={handleTagSelect}
                                            onTagHover={setSelectedIndex}
                                            suggestionPlacement="bottom"
                                        />
                                    </div>

                                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{t('dashboard.selectBookmark')}</p>
                                </div>
                            </div>
                        )
                    )}

                    {activeTab === 'chat' && (
                        <div className="chat-section">
                            <div className="chat-window">
                                {messages.map((message, index) => (
                                    <div key={message.id} className={`chat-message chat-message--${message.role}`}>
                                        <div className={`chat-avatar ${message.role === 'user' ? 'chat-avatar--user' : 'chat-avatar--ai'}`}>
                                            {message.role === 'user' ? (
                                                user?.user_metadata?.avatar_url ? (
                                                    <img src={user.user_metadata.avatar_url} alt="You" />
                                                ) : (
                                                    <div className="avatar-placeholder">{user?.email?.charAt(0).toUpperCase() || 'U'}</div>
                                                )
                                            ) : (
                                                <div className="ai-avatar-icon">
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <title>AI Avatar</title>
                                                        <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" fill="currentColor" stroke="none" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                        <div className="chat-bubble-container">
                                            <div className={`chat-bubble ${message.content ? 'markdown-body' : 'chat-bubble--loading'}`}>
                                                {message.content ? (
                                                    <MessageContent content={message.content} citations={message.citations} />
                                                ) : message.role === 'assistant' ? (
                                                    <div className="typing-indicator">
                                                        <span />
                                                        <span />
                                                        <span />
                                                    </div>
                                                ) : null}
                                            </div>
                                            {message.role === 'assistant' && (
                                                <div className="chat-actions">
                                                    <button
                                                        type="button"
                                                        className="chat-action-btn"
                                                        onClick={() => handleCopyMessage(message.id, message.content)}
                                                        title="Copy response"
                                                    >
                                                        {copiedMessageId === message.id ? (
                                                            <>
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><title>Copied</title><polyline points="20 6 9 17 4 12" /></svg>
                                                                <span>Copied!</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><title>Copy</title><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                                                                <span>Copy</span>
                                                            </>
                                                        )}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="chat-action-btn"
                                                        onClick={() => handleRegenerateResponse(index)}
                                                        disabled={regeneratingMessageId === message.id}
                                                        title="Regenerate response"
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><title>Regenerate</title><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 21h5v-5" /></svg>
                                                        <span>{regeneratingMessageId === message.id ? 'Regenerating...' : 'Regenerate'}</span>
                                                    </button>
                                                </div>
                                            )}
                                            {/* Only show citations after streaming is complete */}
                                            {message.citations && message.citations.length > 0 && !chatLoading && (
                                                <div className="chat-citations">
                                                    <span className="chat-citations-label">{t('chat.sources')}</span>
                                                    <div className="chat-citations-list">
                                                        {message.citations.map((citation) => (
                                                            <a
                                                                key={citation.bookmark.id}
                                                                href={citation.bookmark.url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="citation-chip"
                                                                title={citation.bookmark.title}
                                                            >
                                                                <span className="citation-title">{citation.bookmark.title || t('dashboard.untitled')}</span>
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {!messages.length && (
                                    <div className="chat-empty">
                                        <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>👋</div>
                                        <h3 style={{ margin: '0 0 0.75rem 0', color: 'var(--text-primary)', fontSize: '1.5rem' }}>{t('chat.welcomeTitle')}</h3>
                                        <p style={{ margin: 0, fontSize: '1.125rem' }}>{t('chat.welcomeSubtitle')}</p>
                                    </div>
                                )}
                            </div>
                            <ChatInput
                                value={question}
                                onChange={handleChatInputChange}
                                onSend={() => askAssistant()}
                                onKeyDown={(e) => handleKeyDown(e, () => askAssistant())}
                                loading={chatLoading}
                                tags={chatTags}
                                onRemoveTag={handleRemoveChatTag}
                                showTagSuggestions={showTagSuggestions}
                                filteredTags={filteredTags}
                                selectedTagIndex={selectedIndex}
                                onTagSelect={handleTagSelect}
                                onTagHover={setSelectedIndex}
                                inputRef={chatInputRef}
                                suggestionPlacement="top"
                            />
                            {chatError && <p className="chat-error">{chatError}</p>}
                        </div>
                    )}

                    {activeTab === 'notes' && (
                        <div className="notes-section">
                            <div className="notes-input-group">
                                <label className="notes-label" htmlFor="note-title">Note Title</label>
                                <input
                                    id="note-title"
                                    value={noteTitle}
                                    onChange={(e) => setNoteTitle(e.target.value)}
                                    className="notes-title-input"
                                />
                            </div>
                            <p className="notes-helper-text">
                                Select bookmarks from the sidebar to include them in your note. ({selectedIds.length} selected)
                            </p>
                            <button
                                type="button"
                                className="primary"
                                onClick={buildNote}
                                disabled={!selectedBookmarks.length}
                            >
                                Generate Note
                            </button>

                            {note && (
                                <div className="notes-preview">
                                    <h3>Preview</h3>
                                    <pre className="notes-pre">
                                        {note.body}
                                    </pre>
                                    <div className="notes-actions">
                                        <button type="button" className="ghost" onClick={exportNote} disabled={exporting}>
                                            {exporting ? 'Exporting...' : 'Export to Google Docs'}
                                        </button>
                                        {note.exportUrl && (
                                            <a href={note.exportUrl} target="_blank" rel="noreferrer" className="notes-link">
                                                Open in Google Docs
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

            </main >

            {/* Right Sidebar - Chat History (Only in Chat Tab) */}
            {
                activeTab === 'chat' && isChatHistoryOpen && (
                    <aside className="sidebar-right">
                        <div className="sidebar__header">
                            <h1 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{t('sidebar.chats')}</h1>
                            <div className="flex-center" style={{ gap: '0.5rem' }}>
                                <button type="button" className="btn-icon" onClick={handleResetSession} title={t('sidebar.resetChat')}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><title>{t('sidebar.resetChat')}</title><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                                </button>
                                <button type="button" className="btn-icon" onClick={() => createNewSession()} title={t('sidebar.newChat')}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><title>{t('sidebar.newChat')}</title><path d="M12 5v14M5 12h14" /></svg>
                                </button>
                            </div>
                        </div>
                        <div className="sidebar__list">
                            {sessions.map((session) => (
                                <div
                                    key={session.id}
                                    className={`nav-item ${activeSessionId === session.id ? 'active' : ''}`}
                                    onClick={() => setActiveSessionId(session.id)}
                                    // biome-ignore lint/a11y/useSemanticElements: Nested interactive elements require div
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            setActiveSessionId(session.id);
                                        }
                                    }}
                                >
                                    <div className="flex-between">
                                        <h3 style={{ margin: 0 }}>{session.title}</h3>
                                        <button
                                            type="button"
                                            className="btn-icon danger"
                                            style={{ padding: '2px', opacity: 0.6 }}
                                            onClick={(e) => deleteSession(e, session.id)}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><title>{t('sidebar.deleteChat')}</title><path d="M18 6L6 18M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                    <p>{new Date(session.updatedAt).toLocaleDateString()}</p>
                                </div>
                            ))}
                        </div>
                    </aside>
                )
            }

            <Drawer
                isOpen={subscriptionDrawerOpen}
                onClose={() => setSubscriptionDrawerOpen(false)}
                title={t('subscription.title')}
            >
                <SubscriptionManager />
            </Drawer>

            <ConfirmationModal
                isOpen={modalConfig.isOpen}
                onClose={closeConfirm}
                onConfirm={modalConfig.onConfirm}
                title={modalConfig.title}
                message={modalConfig.message}
                isDangerous={modalConfig.isDangerous}
            />
        </div >
    );
}
