import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useBookmarksContext } from '@/contexts/BookmarkContext';
import type { PageContextPayload } from '@/types/messages';
import { requestPageContext } from '@/utils/chrome';
import { getUserSubscription } from '@/services/subscriptionService';
import type { Subscription } from '@/types/subscription';
import { SubscriptionBadge } from '@/components/SubscriptionBadge';

const DEFAULT_FORM = {
    title: '',
    url: ''
};

export default function PopupApp() {
    const { user, login, logout, loading } = useAuth();
    const { save } = useBookmarksContext();
    const { t } = useTranslation();
    const [form, setForm] = useState(DEFAULT_FORM);
    const [pageContext, setPageContext] = useState<PageContextPayload | null>(null);
    const [saving, setSaving] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [subscription, setSubscription] = useState<Subscription | null>(null);

    useEffect(() => {
        if (user) {
            getUserSubscription(user.id).then(setSubscription);
        }
    }, [user]);

    useEffect(() => {
        requestPageContext().then((context) => {
            if (!context) return;
            setPageContext(context);
            setForm((prev) => ({
                ...prev,
                title: context.title ?? prev.title,
                url: context.url ?? prev.url
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
                tags: [],
                summary: '',
                rawContent: pageContext?.content
            });
            setStatusMessage(t('popup.status.saved'));

            // Close popup after successful save
            setTimeout(() => {
                window.close();
            }, 500);
        } catch (error) {
            console.error(error);
            setStatusMessage(t('popup.status.failed'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="w-[360px] p-4 bg-bg-main">
            <header className="flex items-center justify-between mb-4 pb-3 border-b border-border">
                <h1 className="text-lg font-semibold text-text-primary">{t('popup.title')}</h1>
                <div className="flex items-center gap-2">
                    <SubscriptionBadge subscription={subscription} />
                    {loading ? (
                        <span className="text-xs text-text-secondary">...</span>
                    ) : user ? (
                        <>
                            {userProfile.avatarUrl ? (
                                <img
                                    src={userProfile.avatarUrl}
                                    alt={userProfile.name}
                                    className="w-8 h-8 rounded-full object-cover border-2 border-border"
                                />
                            ) : (
                                <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium">{userInitials}</span>
                            )}
                        </>
                    ) : (
                        <button type="button" className="text-sm text-primary hover:underline" onClick={login}>
                            {t('app.signIn')}
                        </button>
                    )}
                </div>
            </header>

            <form className="flex flex-col gap-4" onSubmit={handleSave}>
                <div className="flex flex-col gap-1.5">
                    <label htmlFor="title" className="text-sm font-medium text-text-primary">{t('popup.fieldTitle')}</label>
                    <input
                        id="title"
                        type="text"
                        value={form.title}
                        onChange={(event) => setForm({ ...form, title: event.target.value })}
                        placeholder={t('popup.placeholderTitle')}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-bg-main text-text-primary placeholder:text-text-secondary outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label htmlFor="url" className="text-sm font-medium text-text-primary">{t('popup.fieldUrl')}</label>
                    <input
                        id="url"
                        type="url"
                        value={form.url}
                        onChange={(event) => setForm({ ...form, url: event.target.value })}
                        placeholder={t('popup.placeholderUrl')}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-bg-main text-text-primary placeholder:text-text-secondary outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                </div>

                <div className="text-xs text-text-secondary italic">
                    {t('popup.aiGenerationNote', 'AI will generate tags and summary automatically.')}
                </div>

                {statusMessage && (
                    <div className="px-3 py-2 text-sm rounded-lg bg-success-bg border border-success-border text-success">
                        {statusMessage}
                    </div>
                )}

                <div className="flex gap-2 pt-2">
                    <button
                        type="submit"
                        className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!user || saving}
                    >
                        {!user ? t('popup.signInToSave') : saving ? t('popup.saving') : t('popup.save')}
                    </button>
                    <button
                        type="button"
                        className="px-4 py-2.5 text-sm font-medium rounded-lg border border-border text-text-primary hover:bg-bg-subtle transition-colors"
                        onClick={openWorkspace}
                    >
                        {t('app.openWorkspace')}
                    </button>
                </div>
            </form>
        </div>
    );
}
