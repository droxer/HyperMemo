import { useMemo, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '@/contexts/AuthContext';
import { useBookmarksContext } from '@/contexts/BookmarkContext';
import { getBookmark } from '@/services/bookmarkService';
import { generateSummary, extractSmartTags } from '@/services/mlService';
import { TagInput } from '@/components/TagInput';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { SubscriptionBadge } from '@/components/SubscriptionBadge';
import { SubscriptionManager } from '@/components/SubscriptionManager';
import type { Bookmark, ChatMessage, NoteDocument, ChatSession } from '@/types/bookmark';
import type { Subscription } from '@/types/subscription';
import { draftAnswerFromBookmarks, type RagMatch } from '@/services/ragService';
import { composeNoteFromBookmarks, exportNoteToGoogleDocs } from '@/services/notesService';
import { getUserSubscription } from '@/services/subscriptionService';
import { ApiError } from '@/services/apiClient';
import { chromeStorage } from '@/utils/chrome';

export default function DashboardApp() {
    const { user, login, logout, loading } = useAuth();
    const { bookmarks, save, remove } = useBookmarksContext();
    const { t } = useTranslation();

    // Navigation State
    const [activeTab, setActiveTab] = useState<'overview' | 'chat' | 'notes' | 'subscription'>('overview');
    const [activeBookmarkId, setActiveBookmarkId] = useState<string | null>(null);
    const [detailedBookmark, setDetailedBookmark] = useState<Bookmark | null>(null);
    const [loadingContent, setLoadingContent] = useState(false);

    // Chat State
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [question, setQuestion] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [chatError, setChatError] = useState<string | null>(null);

    // Feature State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [noteTitle, setNoteTitle] = useState('HyperMemo Notes');
    const [note, setNote] = useState<NoteDocument | null>(null);
    const [exporting, setExporting] = useState(false);
    const [citations, setCitations] = useState<RagMatch[]>([]);
    const [isRegeneratingTags, setIsRegeneratingTags] = useState(false);
    const [isRegeneratingSummary, setIsRegeneratingSummary] = useState(false);
    const [selectedTag, setSelectedTag] = useState<string | null>(null);

    // Subscription State
    const [subscription, setSubscription] = useState<Subscription | null>(null);

    // Chat Tag State
    const [chatTags, setChatTags] = useState<string[]>([]);
    const [showTagSuggestions, setShowTagSuggestions] = useState(false);
    const [tagSearch, setTagSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const chatInputRef = useRef<HTMLTextAreaElement>(null);

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

    const allTags = useMemo(() => {
        const tags = new Set<string>();
        for (const b of bookmarks) {
            if (b.tags) {
                for (const t of b.tags) {
                    tags.add(t);
                }
            }
        }
        return Array.from(tags).sort();
    }, [bookmarks]);

    const filteredTags = useMemo(() => {
        if (!tagSearch) return allTags;
        return allTags.filter(t => t.toLowerCase().includes(tagSearch.toLowerCase()));
    }, [allTags, tagSearch]);

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
                'Upgrade to Pro',
                'Chat with your bookmarks using RAG technology is a Pro feature. Upgrade to unlock intelligent conversations with your saved knowledge.',
                () => setActiveTab('subscription')
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
        setLoadingContent(true);
        setDetailedBookmark(null);
        try {
            const fullBookmark = await getBookmark(id);
            setDetailedBookmark(fullBookmark);
        } catch (error) {
            console.error('Failed to fetch full bookmark content', error);
        } finally {
            setLoadingContent(false);
        }
    };

    const handleDelete = () => {
        if (!activeBookmarkId) return;
        openConfirm(
            t('dashboard.deleteBookmark'),
            'Are you sure you want to delete this bookmark?',
            async () => {
                const bookmarkIdToDelete = activeBookmarkId;

                // Optimistic update - clear UI immediately
                setActiveBookmarkId(null);
                setDetailedBookmark(null);

                try {
                    // Delete in background
                    await remove(bookmarkIdToDelete);
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
                'Upgrade to Pro',
                'Auto-tagging is a Pro feature. Upgrade to automatically generate smart tags for your bookmarks.',
                () => setActiveTab('subscription')
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
        } catch (error) {
            console.error('Failed to regenerate tags', error);
        } finally {
            setIsRegeneratingTags(false);
        }
    };

    const handleRegenerateSummary = async () => {
        if (!isPro) {
            openConfirm(
                'Upgrade to Pro',
                'AI-powered summaries are a Pro feature. Upgrade to automatically generate summaries for your bookmarks.',
                () => setActiveTab('subscription')
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

    const handleChatInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const value = e.target.value;
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

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
            askAssistant();
        }
    };

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

        const userMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: currentQuestion,
            createdAt: new Date().toISOString()
        };

        // Optimistically update UI
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
                        messages: [...s.messages, userMessage],
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
            const response = await draftAnswerFromBookmarks(currentQuestion, chatTags);
            setCitations(response.matches);

            const assistantMessage: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: response.answer,
                createdAt: new Date().toISOString(),
                citations: response.matches
            };

            setSessions(prevSessions => prevSessions.map(s =>
                s.id === targetSessionId
                    ? { ...s, messages: [...s.messages, assistantMessage], updatedAt: new Date().toISOString() }
                    : s
            ));
        } catch (error) {
            console.error('Failed to query RAG backend', error);
            setChatError('Failed to get answer. Please try again.');
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
                    <h1>{t('app.signInTitle')}</h1>
                    <p>{t('app.signInDesc')}</p>
                    <button type="button" className="primary" onClick={login}>
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
                    >
                        <option value="">{t('sidebar.allTags')}</option>
                        {allTags.map(tag => (
                            <option key={tag} value={tag}>{tag}</option>
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
                            {t('tabs.overview')}
                        </button>
                        <button
                            type="button"
                            className={`tab ${activeTab === 'chat' ? 'active' : ''}`}
                            onClick={() => {
                                if (!isPro) {
                                    openConfirm(
                                        'Upgrade to Pro',
                                        'Chat with your bookmarks using RAG technology is a Pro feature. Upgrade to unlock intelligent conversations with your saved knowledge.',
                                        () => setActiveTab('subscription')
                                    );
                                    return;
                                }
                                setActiveTab('chat');
                            }}
                        >
                            {t('tabs.chat')}
                            {!isPro && <span className="badge badge-pro" style={{ marginLeft: '0.5rem' }}>Pro</span>}
                        </button>
                        <button
                            type="button"
                            className="tab"
                            disabled
                            style={{ opacity: 0.5, cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            {t('tabs.notes')}
                            <span className="badge badge-subtle">{t('tabs.comingSoon')}</span>
                        </button>
                        <button
                            type="button"
                            className={`tab ${activeTab === 'subscription' ? 'active' : ''}`}
                            onClick={() => setActiveTab('subscription')}
                        >
                            {t('tabs.subscription')}
                        </button>
                    </div>
                    <div className="flex-center">
                        {activeTab === 'chat' && (
                            <div style={{ marginRight: '0.5rem' }} />
                        )}
                        <SubscriptionBadge subscription={subscription} />
                        {user.user_metadata?.avatar_url || user.user_metadata?.picture ? (
                            <img
                                src={user.user_metadata.avatar_url || user.user_metadata.picture}
                                alt={user.email || 'User'}
                                className="user-avatar"
                                title={user.email}
                            />
                        ) : (
                            <span className="user-email">{user.email}</span>
                        )}
                        <button type="button" className="ghost btn-sm" onClick={logout}>
                            {t('app.signOut')}
                        </button>
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

                                <div className="detail-tags">
                                    <div className="detail-tags-header">
                                        <span className="detail-tags-label">{t('popup.fieldTags')}</span>
                                        <button
                                            type="button"
                                            className="btn-icon"
                                            onClick={handleRegenerateTags}
                                            disabled={isRegeneratingTags}
                                            title={t('dashboard.autoTag')}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><title>{t('dashboard.autoTag')}</title><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 21h5v-5" /></svg>
                                            {isRegeneratingTags ? t('dashboard.analyzing') : t('dashboard.autoTag')}
                                        </button>
                                    </div>
                                    <TagInput
                                        value={activeBookmark.tags || []}
                                        onChange={handleUpdateTags}
                                        placeholder={t('dashboard.addTags')}
                                    />
                                </div>

                                <div className="detail-content">
                                    <div className="detail-content-header">
                                        <h2 className="detail-content-title">{t('dashboard.summary')}</h2>
                                        <button
                                            type="button"
                                            className="btn-icon"
                                            onClick={handleRegenerateSummary}
                                            disabled={isRegeneratingSummary}
                                            title={t('dashboard.regenerate')}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><title>{t('dashboard.regenerate')}</title><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                            {isRegeneratingSummary ? t('dashboard.writing') : t('dashboard.regenerate')}
                                        </button>
                                    </div>


                                    <div className="markdown-body">
                                        {loadingContent && (
                                            <div className="text-subtle" style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
                                                {t('dashboard.fetchingContent')}
                                            </div>
                                        )}
                                        {detailedBookmark?.rawContent && (
                                            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-subtle)', borderRadius: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                                <strong>📄 Original Content</strong> - Showing full page content
                                            </div>
                                        )}
                                        <ReactMarkdown>
                                            {detailedBookmark?.rawContent || detailedBookmark?.summary || activeBookmark.summary || t('dashboard.noContent')}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="empty-state">
                                <div className="flex-center" style={{ flexDirection: 'column', gap: '1.5rem', opacity: 0.8, maxWidth: '600px', width: '100%', margin: '0 auto' }}>
                                    <img src="/icons/icon-128.png" alt="HyperMemo" style={{ width: 80, height: 80 }} />
                                    <div style={{ textAlign: 'center' }}>
                                        <h1 style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.025em', marginBottom: '0.5rem', color: '#1e293b' }}>{t('app.name')}</h1>
                                        <p style={{ fontSize: '1.125rem', color: '#64748b', margin: 0 }}>{t('app.slogan')}</p>
                                    </div>

                                    <div className="landing-search" style={{ width: '100%', position: 'relative' }}>
                                        {chatTags.length > 0 && (
                                            <div className="chat-tags" style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                                                {chatTags.map(tag => (
                                                    <span key={tag} style={{
                                                        background: '#e0f2fe',
                                                        color: '#0369a1',
                                                        padding: '2px 8px',
                                                        borderRadius: '12px',
                                                        fontSize: '0.75rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}>
                                                        @{tag}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveChatTag(tag)}
                                                            style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: 'inherit' }}
                                                        >
                                                            ×
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        <div style={{
                                            position: 'relative',
                                            display: 'flex',
                                            alignItems: 'center',
                                            background: 'white',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '1.25rem',
                                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025)',
                                            padding: '1rem 1.25rem',
                                            transition: 'box-shadow 0.2s, border-color 0.2s'
                                        }}>
                                            <div style={{ marginRight: '1rem', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <title>Search</title>
                                                    <circle cx="11" cy="11" r="8" />
                                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                                </svg>
                                            </div>
                                            <input
                                                type="text"
                                                value={question}
                                                onChange={handleChatInputChange}
                                                onKeyDown={(e) => {
                                                    handleKeyDown(e);
                                                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !showTagSuggestions) {
                                                        handleLandingPageSearch();
                                                    }
                                                }}
                                                placeholder="Ask anything about your bookmarks..."
                                                style={{
                                                    flex: 1,
                                                    border: 'none',
                                                    outline: 'none',
                                                    fontSize: '1.125rem',
                                                    lineHeight: '1.5',
                                                    color: '#1e293b',
                                                    background: 'transparent'
                                                }}
                                            />
                                            <button
                                                type="button"
                                                onClick={handleLandingPageSearch}
                                                disabled={!question.trim()}
                                                style={{
                                                    background: question.trim() ? '#0f172a' : '#f1f5f9',
                                                    color: question.trim() ? 'white' : '#cbd5e1',
                                                    border: 'none',
                                                    borderRadius: '0.75rem',
                                                    padding: '0.5rem',
                                                    cursor: question.trim() ? 'pointer' : 'default',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    transition: 'all 0.2s',
                                                    marginLeft: '0.5rem'
                                                }}
                                            >
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <title>Send</title>
                                                    <line x1="22" y1="2" x2="11" y2="13" />
                                                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                                </svg>
                                            </button>
                                        </div>

                                        {showTagSuggestions && (
                                            <div className="tag-suggestions" style={{
                                                position: 'absolute',
                                                top: '100%',
                                                left: 0,
                                                right: 0,
                                                marginTop: '0.5rem',
                                                background: 'white',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '0.5rem',
                                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                                maxHeight: '200px',
                                                overflowY: 'auto',
                                                zIndex: 10
                                            }}>
                                                {filteredTags.map((tag, index) => (
                                                    <button
                                                        type="button"
                                                        key={tag}
                                                        onClick={() => handleTagSelect(tag)}
                                                        style={{
                                                            padding: '0.5rem 1rem',
                                                            cursor: 'pointer',
                                                            fontSize: '0.875rem',
                                                            color: '#334155',
                                                            background: index === selectedIndex ? '#f1f5f9' : 'white',
                                                            border: 'none',
                                                            width: '100%',
                                                            textAlign: 'left',
                                                            display: 'block'
                                                        }}
                                                        onMouseEnter={() => setSelectedIndex(index)}
                                                    >
                                                        {tag}
                                                    </button>
                                                ))}
                                                {filteredTags.length === 0 && (
                                                    <div style={{ padding: '0.5rem 1rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                                                        No tags found
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>{t('dashboard.selectBookmark')}</p>
                                </div>
                            </div>
                        )
                    )}

                    {activeTab === 'chat' && (
                        <div className="chat-section">
                            <div className="chat-window">
                                {messages.map((message) => (
                                    <div key={message.id} className={`chat-message chat-message--${message.role}`}>
                                        <div className="chat-avatar">
                                            {message.role === 'user' ? t('chat.you') : t('chat.ai')}
                                        </div>
                                        <div className="chat-bubble-container">
                                            <div className="chat-bubble markdown-body">
                                                <ReactMarkdown>{message.content}</ReactMarkdown>
                                            </div>
                                            {message.citations && message.citations.length > 0 && (
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
                                                                {citation.bookmark.title || t('dashboard.untitled')}
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
                                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👋</div>
                                        <h3 style={{ margin: '0 0 0.5rem 0', color: '#1e293b' }}>Welcome to HyperMemo Chat</h3>
                                        <p style={{ margin: 0 }}>Ask me anything about your saved bookmarks.</p>
                                    </div>
                                )}
                            </div>
                            <div className="chat-input-container" style={{ position: 'relative' }}>
                                {chatTags.length > 0 && (
                                    <div className="chat-tags" style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem', flexWrap: 'wrap' }}>
                                        {chatTags.map(tag => (
                                            <span key={tag} style={{
                                                background: '#e0f2fe',
                                                color: '#0369a1',
                                                padding: '2px 8px',
                                                borderRadius: '12px',
                                                fontSize: '0.75rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                @{tag}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveChatTag(tag)}
                                                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: 'inherit' }}
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {showTagSuggestions && (
                                    <div className="tag-suggestions" style={{
                                        position: 'absolute',
                                        bottom: '100%',
                                        left: 0,
                                        background: 'white',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '0.5rem',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                        maxHeight: '200px',
                                        overflowY: 'auto',
                                        width: '200px',
                                        zIndex: 10
                                    }}>
                                        {filteredTags.map((tag, index) => (
                                            <button
                                                type="button"
                                                key={tag}
                                                onClick={() => handleTagSelect(tag)}
                                                style={{
                                                    padding: '0.5rem 1rem',
                                                    cursor: 'pointer',
                                                    fontSize: '0.875rem',
                                                    color: '#334155',
                                                    background: index === selectedIndex ? '#f1f5f9' : 'white',
                                                    border: 'none',
                                                    width: '100%',
                                                    textAlign: 'left',
                                                    display: 'block'
                                                }}
                                                onMouseEnter={() => setSelectedIndex(index)}
                                            >
                                                {tag}
                                            </button>
                                        ))}
                                        {filteredTags.length === 0 && (
                                            <div style={{ padding: '0.5rem 1rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                                                No tags found
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div style={{
                                    position: 'relative',
                                    display: 'flex',
                                    alignItems: 'center',
                                    background: 'white',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '1rem',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                                    padding: '0.75rem 1rem'
                                }}>
                                    <div style={{ marginRight: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', height: '100%' }}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <title>Search</title>
                                            <circle cx="11" cy="11" r="8" />
                                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                        </svg>
                                    </div>
                                    <textarea
                                        ref={chatInputRef}
                                        value={question}
                                        onChange={(e) => {
                                            handleChatInputChange(e);
                                            e.target.style.height = 'auto';
                                            e.target.style.height = `${e.target.scrollHeight}px`;
                                        }}
                                        placeholder={t('chat.placeholder')}
                                        onKeyDown={handleKeyDown}
                                        className="chat-textarea"
                                        rows={1}
                                        style={{
                                            flex: 1,
                                            border: 'none',
                                            outline: 'none',
                                            fontSize: '1rem',
                                            lineHeight: '1.5',
                                            padding: 0,
                                            color: '#1e293b',
                                            resize: 'none',
                                            overflow: 'hidden',
                                            background: 'transparent',
                                            minHeight: '24px',
                                            maxHeight: '150px'
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => askAssistant()}
                                        disabled={chatLoading || !question.trim()}
                                        style={{
                                            background: question.trim() ? '#0f172a' : '#f1f5f9',
                                            color: question.trim() ? 'white' : '#cbd5e1',
                                            border: 'none',
                                            borderRadius: '0.5rem',
                                            padding: '0.5rem',
                                            cursor: question.trim() ? 'pointer' : 'default',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.2s',
                                            alignSelf: 'flex-end',
                                            marginLeft: '0.5rem'
                                        }}
                                    >
                                        {chatLoading ? (
                                            <div className="spinner" style={{ width: 20, height: 20, border: '2px solid #cbd5e1', borderTopColor: '#64748b' }} />
                                        ) : (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <title>Send</title>
                                                <line x1="22" y1="2" x2="11" y2="13" />
                                                <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>
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
                activeTab === 'chat' && (
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

            {activeTab === 'subscription' && (
                <div className="subscription-view">
                    <SubscriptionManager />
                </div>
            )}

            <ConfirmationModal
                isOpen={modalConfig.isOpen}
                onClose={closeConfirm}
                onConfirm={modalConfig.onConfirm}
                title={modalConfig.title}
                message={modalConfig.message}
                isDangerous={modalConfig.isDangerous}
            />
        </div>
    );
}
