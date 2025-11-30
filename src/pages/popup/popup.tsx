import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBookmarksContext } from '@/contexts/BookmarkContext';
import type { Bookmark } from '@/types/bookmark';
import type { PageContextPayload } from '@/types/messages';
import { TagInput } from '@/components/TagInput';
import { requestPageContext } from '@/utils/chrome';
import { summarizeText, extractTags } from '@/utils/summarize';
import { generateSummary, extractSmartTags } from '@/services/mlService';

const DEFAULT_FORM = {
  title: '',
  url: '',
  tags: [] as string[],
  summary: '',
  note: ''
};

export default function PopupApp() {
  const { user, login, logout, loading } = useAuth();
  const { bookmarks, save, loading: bookmarkLoading } = useBookmarksContext();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [pageContext, setPageContext] = useState<PageContextPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [tagging, setTagging] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    requestPageContext().then((context) => {
      if (!context) return;
      setPageContext(context);
      setForm((prev) => ({
        ...prev,
        title: context.title ?? prev.title,
        url: context.url ?? prev.url,
        summary: prev.summary || summarizeText(context.content ?? ''),
        tags: prev.tags.length ? prev.tags : extractTags(`${context.title} ${context.content}`)
      }));
    });
  }, []);

  const recentBookmarks = useMemo<Bookmark[]>(() => bookmarks.slice(0, 5), [bookmarks]);
  const userEmail = user?.email ?? '';
  const userProfile = useMemo(() => {
    if (!user) {
      return { name: '', avatarUrl: null as string | null };
    }
    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
    const nameCandidates = [
      metadata.name,
      metadata.full_name,
      metadata.display_name,
      metadata.user_name
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
    const avatarCandidates = [metadata.avatar_url, metadata.picture].filter(
      (value): value is string => typeof value === 'string' && value.trim().length > 0
    );
    return {
      name: nameCandidates[0] ?? '',
      avatarUrl: avatarCandidates[0] ?? null
    };
  }, [user]);
  const userInitials = useMemo(() => {
    if (!user) return '?';
    const source = userProfile.name || userEmail || '?';
    const initials = source
      .split(/\s+/)
      .map((chunk: string) => (chunk[0] ?? '').toUpperCase())
      .join('');
    return (initials || '?').slice(0, 2);
  }, [user, userProfile.name, userEmail]);

  const openWorkspace = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open('pages/dashboard/index.html', '_blank');
    }
  };

  const handleSummarize = async () => {
    if (!pageContext) return;
    setSummarizing(true);
    try {
      const summary = await generateSummary({
        content: pageContext.content,
        title: pageContext.title,
        url: pageContext.url
      });
      setForm((prev) => ({ ...prev, summary }));
    } catch (error) {
      console.warn('Falling back to local summary', error);
      setForm((prev) => ({
        ...prev,
        summary: summarizeText(pageContext.content ?? '')
      }));
    } finally {
      setSummarizing(false);
    }
  };

  const handleSmartTags = async () => {
    if (!pageContext) return;
    setTagging(true);
    try {
      const tags = await extractSmartTags({
        content: pageContext.content,
        title: pageContext.title,
        url: pageContext.url
      });
      setForm((prev) => ({ ...prev, tags }));
    } catch (error) {
      console.warn('Falling back to heuristic tags', error);
      setForm((prev) => ({
        ...prev,
        tags: extractTags(pageContext.content ?? '').slice(0, 5)
      }));
    } finally {
      setTagging(false);
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) {
      setStatusMessage('Please sign in before saving');
      return;
    }
    if (!form.url) {
      setStatusMessage('Missing URL');
      return;
    }
    setSaving(true);
    setStatusMessage('Saving bookmark…');
    try {
      await save({
        title: form.title || pageContext?.title || 'Untitled',
        url: form.url || pageContext?.url || '',
        tags: form.tags,
        summary: form.summary || summarizeText(pageContext?.content ?? ''),
        note: form.note,
        rawContent: pageContext?.content
      });
      setStatusMessage('Saved!');
    } catch (error) {
      console.error(error);
      setStatusMessage('Failed to save bookmark');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="popup">
      <header className="popup__header">
        <div>
          <h1>HyperMemo</h1>
          <p>Capture the tab and send it to your memory graph.</p>
        </div>
        <div>
          {loading ? (
            <span>Loading…</span>
          ) : user ? (
            <div className="popup__user">
              {userProfile.avatarUrl ? (
                <img src={userProfile.avatarUrl} alt={userProfile.name || userEmail || 'Account'} />
              ) : (
                <span className="popup__avatar-fallback">{userInitials}</span>
              )}
              <div className="popup__user-meta">
                <strong>{userProfile.name || 'Signed in'}</strong>
                {userEmail && <small>{userEmail}</small>}
                <button type="button" className="text" onClick={logout}>
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="primary" onClick={login}>
              Sign in with Google
            </button>
          )}
        </div>
      </header>

      <form className="popup__form" onSubmit={handleSave}>
        <label>
          Title
          <input
            type="text"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            placeholder="Current tab title"
          />
        </label>

        <label>
          URL
          <input
            type="url"
            value={form.url}
            onChange={(event) => setForm({ ...form, url: event.target.value })}
            placeholder="https://"
          />
        </label>

        <div className="form-group">
          <span className="form-group__label">Tags</span>
          <TagInput value={form.tags} onChange={(next) => setForm({ ...form, tags: next })} />
          <button type="button" onClick={handleSmartTags} disabled={tagging} className="text">
            {tagging ? 'Generating…' : 'Suggest tags'}
          </button>
        </div>

        <label>
          Summary
          <textarea
            value={form.summary}
            onChange={(event) => setForm({ ...form, summary: event.target.value })}
            rows={4}
            placeholder="Generate a concise summary"
          />
        </label>

        <label>
          Notes
          <textarea
            value={form.note}
            onChange={(event) => setForm({ ...form, note: event.target.value })}
            rows={3}
            placeholder="Add personal context or TODOs"
          />
        </label>

        <div className="popup__actions">
          <button type="button" onClick={handleSummarize} disabled={summarizing}>
            {summarizing ? 'Summarizing…' : 'Auto summarize'}
          </button>
          <button type="submit" className="primary" disabled={!user || saving}>
            {!user ? 'Sign in to save' : saving ? 'Saving…' : 'Save to HyperMemo'}
          </button>
        </div>
        {statusMessage && <p className="popup__status">{statusMessage}</p>}
      </form>

      <section>
        <div className="section-title">
          <h2>Your latest bookmarks</h2>
          <button type="button" onClick={openWorkspace}>
            Open workspace
          </button>
        </div>
        {bookmarkLoading && <p>Loading bookmarks…</p>}
        {!bookmarkLoading && !recentBookmarks.length && <p>No bookmarks yet.</p>}
        <ul className="bookmark-list">
          {recentBookmarks.map((bookmark) => (
            <li key={bookmark.id}>
              <a href={bookmark.url} target="_blank" rel="noreferrer">
                <strong>{bookmark.title}</strong>
                <p>{bookmark.summary}</p>
              </a>
              <div className="bookmark-list__tags">
                {bookmark.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
