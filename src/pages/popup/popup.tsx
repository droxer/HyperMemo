import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useBookmarksContext } from '@/contexts/BookmarkContext';
import type { PageContextPayload } from '@/types/messages';
import { TagInput } from '@/components/TagInput';
import { requestPageContext } from '@/utils/chrome';
import { summarizeText, extractTags } from '@/utils/summarize';
import { generateSummary, extractSmartTags } from '@/services/mlService';
import { getUserSubscription } from '@/services/subscriptionService';
import type { Subscription } from '@/types/subscription';
import { SubscriptionBadge } from '@/components/SubscriptionBadge';

const DEFAULT_FORM = {
    title: '',
    url: '',
    tags: [] as string[],
    summary: ''
};

export default function PopupApp() {
    const { user, login, logout, loading } = useAuth();
    const { save } = useBookmarksContext();
    const { t } = useTranslation();
    const [form, setForm] = useState(DEFAULT_FORM);
    const [pageContext, setPageContext] = useState<PageContextPayload | null>(null);
    const [saving, setSaving] = useState(false);
    const [summarizing, setSummarizing] = useState(false);
    const [tagging, setTagging] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [subscription, setSubscription] = useState<Subscription | null>(null);

    const isPro = useMemo(() => {
        return subscription?.tier === 'pro' &&
            subscription?.status === 'active' &&
            new Date(subscription.endDate) > new Date();
    }, [subscription]);

    useEffect(() => {
        if (user) {
            getUserSubscription().then(setSubscription);
        }
    }, [user]);

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
        if (!isPro) {
            setStatusMessage('Upgrade to Pro for AI summary');
            return;
        }
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
        if (!isPro) {
            setStatusMessage('Upgrade to Pro for auto-tags');
            return;
        }
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
            setStatusMessage(t('popup.status.signIn'));
            return;
        }
        if (!form.url) {
            setStatusMessage(t('popup.status.missingUrl'));
            return;
        }
        setSaving(true);
        setStatusMessage(t('popup.status.saving'));
        try {
            await save({
                title: form.title || pageContext?.title || 'Untitled',
                url: form.url || pageContext?.url || '',
                tags: form.tags,
                summary: form.summary || summarizeText(pageContext?.content ?? ''),
                rawContent: pageContext?.content
            });
            setStatusMessage(t('popup.status.saved'));
        } catch (error) {
            console.error(error);
            setStatusMessage(t('popup.status.failed'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="popup">
            <header className="header">
                <h1>{t('popup.title')}</h1>
                <div className="user-menu">
                    <SubscriptionBadge subscription={subscription} />
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
                            {t('app.signIn')}
                        </button>
                    )}
                </div>
            </header>

            <form className="form" onSubmit={handleSave}>
                <div className="field">
                    <label htmlFor="title">{t('popup.fieldTitle')}</label>
                    <input
                        id="title"
                        type="text"
                        value={form.title}
                        onChange={(event) => setForm({ ...form, title: event.target.value })}
                        placeholder={t('popup.placeholderTitle')}
                    />
                </div>

                <div className="field">
                    <label htmlFor="url">{t('popup.fieldUrl')}</label>
                    <input
                        id="url"
                        type="url"
                        value={form.url}
                        onChange={(event) => setForm({ ...form, url: event.target.value })}
                        placeholder={t('popup.placeholderUrl')}
                    />
                </div>

                <div className="field">
                    <div className="flex justify-between items-center">
                        <label htmlFor="tags-input">{t('popup.fieldTags')}</label>
                        <button
                            type="button"
                            onClick={handleSmartTags}
                            disabled={tagging}
                            className="text text-xs"
                        >
                            {tagging ? t('popup.suggesting') : t('popup.autoSuggest')}
                        </button>
                    </div>
                    <TagInput id="tags-input" value={form.tags} onChange={(next) => setForm({ ...form, tags: next })} />
                </div>

                <div className="field">
                    <div className="flex justify-between items-center">
                        <label htmlFor="summary">{t('popup.fieldSummary')}</label>
                        <button
                            type="button"
                            onClick={handleSummarize}
                            disabled={summarizing}
                            className="text text-xs"
                        >
                            {summarizing ? t('popup.summarizing') : t('popup.autoSummarize')}
                        </button>
                    </div>
                    <textarea
                        id="summary"
                        value={form.summary}
                        onChange={(event) => setForm({ ...form, summary: event.target.value })}
                        rows={3}
                        placeholder={t('popup.placeholderSummary')}
                    />
                </div>

                {statusMessage && <div className="status">{statusMessage}</div>}

                <div className="actions">
                    <button type="submit" className="primary" disabled={!user || saving}>
                        {!user ? t('popup.signInToSave') : saving ? t('popup.saving') : t('popup.save')}
                    </button>
                    <button type="button" className="secondary" onClick={openWorkspace}>
                        {t('app.openWorkspace')}
                    </button>
                </div>
            </form>
        </div>
    );
}
