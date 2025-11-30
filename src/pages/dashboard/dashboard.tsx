import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBookmarksContext } from '@/contexts/BookmarkContext';
import type { Bookmark, ChatMessage, NoteDocument } from '@/types/bookmark';
import { draftAnswerFromBookmarks, type RagMatch } from '@/services/ragService';
import { composeNoteFromBookmarks, exportNoteToGoogleDocs } from '@/services/notesService';
import { ApiError } from '@/services/apiClient';

export default function DashboardApp() {
  const { user, login, logout, loading } = useAuth();
  const { bookmarks } = useBookmarksContext();
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [noteTitle, setNoteTitle] = useState('HyperMemo Notes');
  const [note, setNote] = useState<NoteDocument | null>(null);
  const [exporting, setExporting] = useState(false);
  const [citations, setCitations] = useState<RagMatch[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);

  const selectedBookmarks = useMemo(
    () => bookmarks.filter((bookmark) => selectedIds.includes(bookmark.id)),
    [bookmarks, selectedIds]
  );

  const askAssistant = async () => {
    if (!question.trim()) return;
    setChatLoading(true);
    setChatError(null);
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
      createdAt: new Date().toISOString()
    };
    setMessages((prev) => [...prev, userMessage]);
    try {
      const response = await draftAnswerFromBookmarks(question);
      setCitations(response.matches);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response.answer,
          createdAt: new Date().toISOString()
        }
      ]);
      setQuestion('');
    } catch (error) {
      console.error('Failed to query RAG backend', error);
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setChatError('Authentication failed. Please sign in again.');
        } else if (error.status === 400) {
          const errorBody = error.body as { error?: string } | undefined;
          setChatError(errorBody?.error || 'Invalid request. Please check your question.');
        } else if (error.status >= 500) {
          setChatError('Server error. Please try again later.');
        } else {
          const errorBody = error.body as { error?: string } | undefined;
          setChatError(errorBody?.error || `Request failed (${error.status})`);
        }
      } else if (error instanceof Error) {
        if (error.message.includes('fetch') || error.message.includes('network')) {
          setChatError('Network error. Please check your connection and try again.');
        } else if (error.message.includes('VITE_SUPABASE')) {
          setChatError('Supabase configuration error. Please check your environment settings.');
        } else {
          setChatError(`Error: ${error.message}`);
        }
      } else {
        setChatError('Unable to reach the retrieval service. Please try again.');
      }
    } finally {
      setChatLoading(false);
    }
  };

  const toggleBookmark = (bookmark: Bookmark) => {
    setSelectedIds((prev) =>
      prev.includes(bookmark.id)
        ? prev.filter((id) => id !== bookmark.id)
        : [...prev, bookmark.id]
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
        <p>Loading workspace…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="dashboard dashboard--auth">
        <div className="dashboard__auth-card">
          <h1>Sign in to HyperMemo</h1>
          <p>You need to be signed in to view your bookmarks, chat history, and note exports.</p>
          <button type="button" className="primary" onClick={login}>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header>
        <h1>HyperMemo workspace</h1>
        <div>
          <>
            <span>{user.email}</span>
            <button type="button" onClick={logout}>
              Sign out
            </button>
          </>
        </div>
      </header>

      <section className="dashboard__chat">
        <h2>Chat with your bookmarks</h2>
        <div className="chat-window">
          {messages.map((message) => (
            <div key={message.id} className={`chat-message chat-message--${message.role}`}>
              <small>{message.role === 'user' ? 'You' : 'HyperMemo'}</small>
              <p>{message.content}</p>
            </div>
          ))}
          {!messages.length && <p className="chat-empty">Ask a question to get started.</p>}
        </div>
        <div className="chat-input">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about your saved knowledge"
          />
          <button type="button" onClick={askAssistant} disabled={chatLoading}>
            {chatLoading ? 'Thinking…' : 'Ask'}
          </button>
        </div>
        {chatError && <p className="chat-error">{chatError}</p>}
        {!!citations.length && (
          <div className="chat-citations">
            <small>Sources</small>
            <ul>
              {citations.map(({ bookmark, score }) => (
                <li key={bookmark.id}>
                  <strong>{bookmark.title}</strong> — {(score * 100).toFixed(1)}%
                  <a href={bookmark.url} target="_blank" rel="noreferrer">
                    &nbsp;Open
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="dashboard__notes">
        <h2>Generate Notes</h2>
        <div className="notes-builder">
          <div>
            <label>
              Note title
              <input value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} />
            </label>
            <div className="bookmark-grid">
              {bookmarks.map((bookmark) => (
                <label key={bookmark.id} className="bookmark-tile">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(bookmark.id)}
                    onChange={() => toggleBookmark(bookmark)}
                  />
                  <div>
                    <strong>{bookmark.title}</strong>
                    <p>{bookmark.summary}</p>
                  </div>
                </label>
              ))}
            </div>
            <button type="button" onClick={buildNote} disabled={!selectedBookmarks.length}>
              Build note from selection
            </button>
          </div>
          {note && (
            <aside>
              <h3>Preview</h3>
              <pre>{note.body}</pre>
              <button type="button" onClick={exportNote} disabled={exporting}>
                {exporting ? 'Exporting…' : 'Export to Google Docs'}
              </button>
              {note.exportUrl && (
                <a href={note.exportUrl} target="_blank" rel="noreferrer">
                  View document
                </a>
              )}
            </aside>
          )}
        </div>
      </section>
    </div>
  );
}
