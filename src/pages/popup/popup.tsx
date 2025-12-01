import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBookmarksContext } from '@/contexts/BookmarkContext';
import type { PageContextPayload } from '@/types/messages';
import { TagInput } from '@/components/TagInput';
import { requestPageContext } from '@/utils/chrome';
import { summarizeText, extractTags } from '@/utils/summarize';
import { generateSummary, extractSmartTags } from '@/services/mlService';

const DEFAULT_FORM = {
    title: '',
    url: '',
    tags: [] as string[],
    summary: ''
};

export default function PopupApp() {
    const { user, login, logout, loading } = useAuth();
    const { save } = useBookmarksContext();
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
            <header className="header">
                <h1>Save Bookmark</h1>
                <div className="user-menu">
                    {loading ? (
                        <span className="text-xs text-gray-500">...</span>
                    ) : user ? (
                        <>
                            {userProfile.avatarUrl ? (
                                <img
                                    src={userProfile.avatarUrl}
                                    alt={userProfile.name}
                                    className="avatar"
                                />
                            ) : (
                                <span className="avatar">{userInitials}</span>
                            )}
                        </>
                    ) : (
                        <button type="button" className="text" onClick={login}>
                            Sign in
                        </button>
                    )}
                </div>
            </header>

            <form className="form" onSubmit={handleSave}>
                <div className="field">
                    <label htmlFor="title">Title</label>
                    <input
                        id="title"
                        type="text"
                        value={form.title}
                        onChange={(event) => setForm({ ...form, title: event.target.value })}
                        placeholder="Page title"
                    />
                </div>

                <div className="field">
                    <label htmlFor="url">URL</label>
                    <input
                        id="url"
                        type="url"
                        value={form.url}
                        onChange={(event) => setForm({ ...form, url: event.target.value })}
                        placeholder="https://"
                    />
                </div>

                <div className="field">
                    <div className="flex justify-between items-center">
                        <label htmlFor="tags-input">Tags</label>
                        <button
                            type="button"
                            onClick={handleSmartTags}
                            disabled={tagging}
                            className="text text-xs"
                        >
                            {tagging ? 'Suggesting...' : 'Auto-suggest'}
                        </button>
                    </div>
                    <TagInput id="tags-input" value={form.tags} onChange={(next) => setForm({ ...form, tags: next })} />
                </div>

                <div className="field">
                    <div className="flex justify-between items-center">
                        <label htmlFor="summary">Summary</label>
                        <button
                            type="button"
                            onClick={handleSummarize}
                            disabled={summarizing}
                            className="text text-xs"
                        >
                            {summarizing ? 'Summarizing...' : 'Auto-summarize'}
                        </button>
                    </div>
                    <textarea
                        id="summary"
                        value={form.summary}
                        onChange={(event) => setForm({ ...form, summary: event.target.value })}
                        rows={3}
                        placeholder="Add a note or summary..."
                    />
                </div>

                {statusMessage && <div className="status">{statusMessage}</div>}

                <div className="actions">
                    <button type="submit" className="primary" disabled={!user || saving}>
                        {!user ? 'Sign in to save' : saving ? 'Saving...' : 'Save Bookmark'}
                    </button>
                    <button type="button" className="secondary" onClick={openWorkspace}>
                        Open Workspace
                    </button>
                </div>
            </form>
        </div>
    );
}
