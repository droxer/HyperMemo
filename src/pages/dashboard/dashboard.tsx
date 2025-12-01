import { useMemo, useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '@/contexts/AuthContext';
import { useBookmarksContext } from '@/contexts/BookmarkContext';
import { getBookmark } from '@/services/bookmarkService';
import { generateSummary, extractSmartTags } from '@/services/mlService';
import { TagInput } from '@/components/TagInput';
import type { Bookmark, ChatMessage, NoteDocument, ChatSession } from '@/types/bookmark';
import { draftAnswerFromBookmarks, type RagMatch } from '@/services/ragService';
import { composeNoteFromBookmarks, exportNoteToGoogleDocs } from '@/services/notesService';
import { ApiError } from '@/services/apiClient';
import { chromeStorage } from '@/utils/chrome';

export default function DashboardApp() {
    const { user, login, logout, loading } = useAuth();
    const { bookmarks, save, remove } = useBookmarksContext();

    // Navigation State
    const [activeTab, setActiveTab] = useState<'overview' | 'chat' | 'notes'>('overview');
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
    const [isRegenerating, setIsRegenerating] = useState(false);

    // Chat Tag State
    const [chatTags, setChatTags] = useState<string[]>([]);
    const [showTagSuggestions, setShowTagSuggestions] = useState(false);
    const [tagSearch, setTagSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);

    const activeBookmark = useMemo(
        () => bookmarks.find((b) => b.id === activeBookmarkId),
        [bookmarks, activeBookmarkId]
    );

    const selectedBookmarks = useMemo(
        () => bookmarks.filter((bookmark) => selectedIds.includes(bookmark.id)),
        [bookmarks, selectedIds]
    );

    const activeSession = useMemo(
        () => sessions.find(s => s.id === activeSessionId) || null,
        [sessions, activeSessionId]
    );

    const messages = activeSession?.messages || [];

    const allTags = useMemo(() => {
        const tags = new Set<string>();
        bookmarks.forEach(b => b.tags?.forEach(t => tags.add(t)));
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

    // Save sessions whenever they change
    useEffect(() => {
        if (sessions.length > 0) {
            chromeStorage.set('chat_sessions', sessions);
        }
    }, [sessions]);

    // Save active session ID
    useEffect(() => {
        chromeStorage.set('active_session_id', activeSessionId);
    }, [activeSessionId]);

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

    const deleteSession = async (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        if (confirm('Delete this chat?')) {
            const updatedSessions = sessions.filter(s => s.id !== sessionId);
            setSessions(updatedSessions);
            await chromeStorage.set('chat_sessions', updatedSessions);

            if (activeSessionId === sessionId) {
                if (updatedSessions.length > 0) {
                    setActiveSessionId(updatedSessions[0].id);
                } else {
                    createNewSession(updatedSessions);
                }
            }
        }
    };

    // Handlers
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

    const handleDelete = async () => {
        if (!activeBookmarkId) return;
        if (confirm('Are you sure you want to delete this bookmark?')) {
            await remove(activeBookmarkId);
            setActiveBookmarkId(null);
            setDetailedBookmark(null);
        }
    };

    const handleUpdateTags = async (newTags: string[]) => {
        if (!activeBookmark) return;
        await save({ ...activeBookmark, tags: newTags });
    };

    const handleRegenerateTags = async () => {
        if (!activeBookmark || !detailedBookmark) return;
        setIsRegenerating(true);
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
            setIsRegenerating(false);
        }
    };

    const handleRegenerateSummary = async () => {
        if (!activeBookmark || !detailedBookmark) return;
        setIsRegenerating(true);
        try {
            const summary = await generateSummary({
                content: detailedBookmark.rawContent || detailedBookmark.summary,
                title: activeBookmark.title,
                url: activeBookmark.url
            });
            await save({ ...activeBookmark, summary });
        } catch (error) {
            console.error('Failed to regenerate summary', error);
        } finally {
            setIsRegenerating(false);
        }
    };

    const handleChatInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        setQuestion(words.join(' ') + ' '); // Add space for next typing

        setShowTagSuggestions(false);
        setTagSearch('');
        setSelectedIndex(0);
    };

    const handleRemoveChatTag = (tag: string) => {
        setChatTags(chatTags.filter(t => t !== tag));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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

        if (e.key === 'Enter') {
            askAssistant();
        }
    };

    const handleResetSession = async () => {
        if (!activeSessionId) return;
        if (confirm('Clear all messages in this chat?')) {
            const updatedSessions = sessions.map(s =>
                s.id === activeSessionId
                    ? { ...s, messages: [], updatedAt: new Date().toISOString() }
                    : s
            );
            setSessions(updatedSessions);
        }
    };

    const askAssistant = async () => {
        if (!question.trim() || !activeSessionId) return;
        setChatLoading(true);
        setChatError(null);

        const userMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: question,
            createdAt: new Date().toISOString()
        };

        // Optimistically update UI
        const updatedSessions = sessions.map(s => {
            if (s.id === activeSessionId) {
                // Update title if it's the first message
                const title = s.messages.length === 0 ? question.slice(0, 30) + (question.length > 30 ? '...' : '') : s.title;
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
        const activeSessionIndex = updatedSessions.findIndex(s => s.id === activeSessionId);
        if (activeSessionIndex > 0) {
            const session = updatedSessions[activeSessionIndex];
            updatedSessions.splice(activeSessionIndex, 1);
            updatedSessions.unshift(session);
        }

        setSessions(updatedSessions);

        try {
            const response = await draftAnswerFromBookmarks(question, chatTags);
            setCitations(response.matches);

            const assistantMessage: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: response.answer,
                createdAt: new Date().toISOString()
            };

            setSessions(prevSessions => prevSessions.map(s =>
                s.id === activeSessionId
                    ? { ...s, messages: [...s.messages, assistantMessage], updatedAt: new Date().toISOString() }
                    : s
            ));

            setQuestion('');
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
                <p>Loading workspace...</p>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="dashboard dashboard--auth">
                <div className="dashboard__auth-card">
                    <h1>Sign in to HyperMemo</h1>
                    <p>You need to be signed in to view your bookmarks.</p>
                    <button type="button" className="primary" onClick={login}>
                        Sign in with Google
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
                    <h1>My Library</h1>
                    <span className="text-subtle">{bookmarks.length} items</span>
                </div>
                <div className="sidebar__list">
                    {bookmarks.map((bookmark) => (
                        <div
                            key={bookmark.id}
                            className={`nav-item ${activeBookmarkId === bookmark.id ? 'active' : ''}`}
                            onClick={() => handleBookmarkClick(bookmark.id)}
                        >
                            <h3>{bookmark.title || 'Untitled'}</h3>
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
                            className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
                            onClick={() => setActiveTab('overview')}
                        >
                            Overview
                        </button>
                        <button
                            className={`tab ${activeTab === 'chat' ? 'active' : ''}`}
                            onClick={() => setActiveTab('chat')}
                        >
                            Chat
                        </button>
                        <button
                            className={`tab ${activeTab === 'notes' ? 'active' : ''}`}
                            onClick={() => setActiveTab('notes')}
                        >
                            Notes
                        </button>
                    </div>
                    <div className="flex-center">
                        {activeTab === 'chat' && (
                            <button type="button" className="ghost btn-sm" onClick={handleResetSession} style={{ marginRight: '0.5rem' }}>
                                Reset Chat
                            </button>
                        )}
                        <span className="user-email">{user.email}</span>
                        <button type="button" className="ghost btn-sm" onClick={logout}>
                            Sign out
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
                                                title="Delete bookmark"
                                            >
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="detail-meta">
                                        <a href={activeBookmark.url} target="_blank" rel="noreferrer" className="link-primary flex-center" style={{ gap: '0.5rem' }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                                            {new URL(activeBookmark.url).hostname}
                                        </a>
                                        <span>•</span>
                                        <span>{new Date(activeBookmark.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </header>

                                <div className="detail-tags">
                                    <div className="detail-tags-header">
                                        <span className="detail-tags-label">Tags</span>
                                        <button
                                            type="button"
                                            className="btn-icon"
                                            onClick={handleRegenerateTags}
                                            disabled={isRegenerating}
                                            title="Auto-generate tags"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path><path d="M16 21h5v-5"></path></svg>
                                            {isRegenerating ? 'Analyzing...' : 'Auto-tag'}
                                        </button>
                                    </div>
                                    <TagInput
                                        value={activeBookmark.tags || []}
                                        onChange={handleUpdateTags}
                                        placeholder="Add tags..."
                                    />
                                </div>

                                <div className="detail-content">
                                    <div className="detail-content-header">
                                        <h2 className="detail-content-title">Summary</h2>
                                        <button
                                            type="button"
                                            className="btn-icon"
                                            onClick={handleRegenerateSummary}
                                            disabled={isRegenerating}
                                            title="Regenerate summary"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                            {isRegenerating ? 'Writing...' : 'Regenerate'}
                                        </button>
                                    </div>

                                    <div className="markdown-body">
                                        {loadingContent && (
                                            <div className="text-subtle" style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
                                                Fetching original content...
                                            </div>
                                        )}
                                        <ReactMarkdown>
                                            {detailedBookmark?.rawContent || detailedBookmark?.summary || activeBookmark.summary || 'No content available.'}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="empty-state">
                                <p>Select a bookmark from the sidebar to view its summary.</p>
                            </div>
                        )
                    )}

                    {activeTab === 'chat' && (
                        <div className="chat-section">
                            <div className="chat-window">
                                {messages.map((message) => (
                                    <div key={message.id} className={`chat-message chat-message--${message.role}`}>
                                        <div className="chat-avatar">
                                            {message.role === 'user' ? 'You' : 'AI'}
                                        </div>
                                        <div className="chat-bubble markdown-body">
                                            <ReactMarkdown>{message.content}</ReactMarkdown>
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
                                            <div
                                                key={tag}
                                                onClick={() => handleTagSelect(tag)}
                                                style={{
                                                    padding: '0.5rem 1rem',
                                                    cursor: 'pointer',
                                                    fontSize: '0.875rem',
                                                    color: '#334155',
                                                    background: index === selectedIndex ? '#f1f5f9' : 'white'
                                                }}
                                                onMouseEnter={() => setSelectedIndex(index)}
                                            >
                                                {tag}
                                            </div>
                                        ))}
                                        {filteredTags.length === 0 && (
                                            <div style={{ padding: '0.5rem 1rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                                                No tags found
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="chat-input">
                                    <input
                                        value={question}
                                        onChange={handleChatInputChange}
                                        placeholder="Ask about your saved knowledge... (Type @ to filter by tag)"
                                        onKeyDown={handleKeyDown}
                                    />
                                    <button type="button" className="primary" onClick={askAssistant} disabled={chatLoading}>
                                        {chatLoading ? 'Thinking...' : 'Send'}
                                    </button>
                                </div>
                            </div>
                            {chatError && <p className="chat-error">{chatError}</p>}
                        </div>
                    )}

                    {activeTab === 'notes' && (
                        <div className="notes-section">
                            <div className="notes-input-group">
                                <label className="notes-label">Note Title</label>
                                <input
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

            </main>

            {/* Right Sidebar - Chat History (Only in Chat Tab) */}
            {activeTab === 'chat' && (
                <aside className="sidebar-right">
                    <div className="sidebar__header">
                        <h1 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Chats</h1>
                        <button type="button" className="btn-icon" onClick={() => createNewSession()} title="New Chat">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                        </button>
                    </div>
                    <div className="sidebar__list">
                        {sessions.map((session) => (
                            <div
                                key={session.id}
                                className={`nav-item ${activeSessionId === session.id ? 'active' : ''}`}
                                onClick={() => setActiveSessionId(session.id)}
                            >
                                <div className="flex-between">
                                    <h3 style={{ margin: 0 }}>{session.title}</h3>
                                    <button
                                        className="btn-icon"
                                        style={{ padding: '2px', opacity: 0.6 }}
                                        onClick={(e) => deleteSession(e, session.id)}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                    </button>
                                </div>
                                <p>{new Date(session.updatedAt).toLocaleDateString()}</p>
                            </div>
                        ))}
                    </div>
                </aside>
            )}
        </div>
    );
}
