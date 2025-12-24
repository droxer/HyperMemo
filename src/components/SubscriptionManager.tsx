import { type FC, useEffect, useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import type { Subscription } from '@/types/subscription';
import { getUserSubscription } from '@/services/subscriptionService';
import { isProUser, getSubscriptionDaysRemaining, formatSubscriptionPeriod } from '@/types/subscription';
import { useAuth } from '@/contexts/AuthContext';

const CheckIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-success">
        <title>Included</title>
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const XIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary">
        <title>Not Included</title>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

export const SubscriptionManager: FC = () => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadSubscription = async () => {
            if (user) {
                setLoading(true);
                const sub = await getUserSubscription(user.id);
                setSubscription(sub);
                setLoading(false);
            }
        };
        loadSubscription();
    }, [user]);

    const isPro = isProUser(subscription);
    const daysRemaining = getSubscriptionDaysRemaining(subscription);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
                <svg className="animate-spin w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <title>Loading</title>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                <span className="text-text-secondary">{t('subscription.loading')}</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 md:gap-6">
            {!isPro ? (
                <div className="bg-bg-subtle rounded-xl p-4 md:p-6 border border-primary/20">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3 md:gap-4 mb-4 md:mb-6">
                        <div>
                            <h3 className="text-lg md:text-xl font-semibold text-text-primary">{t('subscription.upgradeTitle')}</h3>
                            <p className="text-sm md:text-base text-text-secondary mt-1">{t('subscription.upgradeSubtitle')}</p>
                        </div>
                        <div className="md:text-right">
                            <p className="text-2xl md:text-3xl font-bold text-text-primary">$4.99<span className="text-sm md:text-base text-text-secondary font-medium">{t('subscription.perMonth')}</span></p>
                        </div>
                    </div>

                    <div className="mb-4 md:mb-6">
                        <h4 className="text-sm font-semibold text-text-primary mb-3">{t('subscription.whatsIncluded')}</h4>
                        <ul className="space-y-2">
                            <li className="flex items-center gap-2"><CheckIcon /> <span className="text-sm md:text-base text-text-primary"><Trans i18nKey="subscription.features.aiChat" /></span></li>
                            <li className="flex items-center gap-2"><CheckIcon /> <span className="text-sm md:text-base text-text-primary"><Trans i18nKey="subscription.features.aiNotes" /></span></li>
                            <li className="flex items-center gap-2"><CheckIcon /> <span className="text-sm md:text-base text-text-primary"><Trans i18nKey="subscription.features.unlimitedBookmarks" /></span></li>
                            <li className="flex items-center gap-2"><CheckIcon /> <span className="text-sm md:text-base text-text-primary"><Trans i18nKey="subscription.features.prioritySupport" /></span></li>
                        </ul>
                    </div>

                    <button className="w-full px-4 py-3 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2" disabled type="button">
                        {t('subscription.upgradeTitle')}
                        <span className="text-xs px-2 py-0.5 bg-white/20 rounded">{t('subscription.comingSoon')}</span>
                    </button>
                    <p className="text-center mt-3 md:mt-4 text-xs md:text-sm text-text-secondary">
                        {t('subscription.securePayment')}
                    </p>
                </div>
            ) : (
                <div className="bg-bg-subtle rounded-xl p-4 md:p-6 border border-success/20">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3 mb-4 md:mb-6">
                        <div>
                            <h3 className="text-lg md:text-xl font-semibold text-text-primary">{t('subscription.proActiveTitle')}</h3>
                            <p className="text-sm md:text-base text-text-secondary mt-1">{t('subscription.proActiveSubtitle')}</p>
                        </div>
                        <div className="md:text-right">
                            <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-success/10 text-success rounded-full">{t('subscription.active')}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:gap-4 mb-4 md:mb-6">
                        <div className="bg-bg-main rounded-lg p-3">
                            <span className="block text-xs text-text-secondary mb-1">{t('subscription.currentPeriod')}</span>
                            <span className="block text-sm font-medium text-text-primary">{subscription ? formatSubscriptionPeriod(subscription) : '-'}</span>
                        </div>
                        <div className="bg-bg-main rounded-lg p-3">
                            <span className="block text-xs text-text-secondary mb-1">{t('subscription.status')}</span>
                            <span className="block text-sm font-medium text-success">{t('subscription.active')}</span>
                        </div>
                        <div className="bg-bg-main rounded-lg p-3">
                            <span className="block text-xs text-text-secondary mb-1">{t('subscription.nextBilling')}</span>
                            <span className="block text-sm font-medium text-text-primary">
                                {subscription?.cancelAtPeriodEnd ? t('subscription.endsOn') : t('subscription.renewsOn')}
                                {subscription ? new Date(subscription.endDate).toLocaleDateString() : '-'}
                            </span>
                        </div>
                        <div className="bg-bg-main rounded-lg p-3">
                            <span className="block text-xs text-text-secondary mb-1">{t('subscription.planCost')}</span>
                            <span className="block text-sm font-medium text-text-primary">$4.99{t('subscription.perMonthLong')}</span>
                        </div>
                    </div>

                    {daysRemaining <= 7 && daysRemaining > 0 && (
                        <div className="flex items-center gap-2 px-4 py-3 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg mb-4">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <title>Warning</title>
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                <line x1="12" y1="9" x2="12" y2="13" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                            <span>{t('subscription.expiresIn', { days: daysRemaining })}</span>
                        </div>
                    )}

                    {subscription?.cancelAtPeriodEnd && (
                        <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg mb-4">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <title>Info</title>
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            <span>{t('subscription.wontRenew')}</span>
                        </div>
                    )}

                    <div className="flex flex-col md:flex-row gap-3">
                        <button className="flex-1 px-4 py-3 text-sm font-medium rounded-lg border border-border text-text-primary hover:bg-bg-main transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2" disabled type="button">
                            {t('subscription.manageBilling')}
                            <span className="text-xs px-2 py-0.5 bg-bg-active rounded">{t('subscription.comingSoon')}</span>
                        </button>
                        {!subscription?.cancelAtPeriodEnd && (
                            <button className="px-4 py-3 text-sm font-medium rounded-lg bg-error text-white hover:bg-error/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2" disabled type="button">
                                {t('subscription.cancelSubscription')}
                                <span className="text-xs px-2 py-0.5 bg-white/20 rounded">{t('subscription.comingSoon')}</span>
                            </button>
                        )}
                    </div>
                </div>
            )}

            <div className="bg-bg-subtle rounded-xl p-4 md:p-6">
                <h3 className="text-base md:text-lg font-semibold text-text-primary mb-3 md:mb-4">{t('subscription.planComparison')}</h3>
                <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
                <table className="w-full text-xs md:text-sm">
                    <thead>
                        <tr className="border-b border-border">
                            <th className="text-left py-3 font-medium text-text-secondary">{t('subscription.table.feature')}</th>
                            <th className="text-center py-3 font-medium text-text-secondary">{t('subscription.table.free')}</th>
                            <th className="text-center py-3 font-medium text-text-secondary">{t('subscription.table.pro')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b border-border/50">
                            <td className="py-3 text-text-primary">{t('subscription.table.bookmarks')}</td>
                            <td className="py-3 text-center text-text-primary">{t('subscription.table.unlimited')}</td>
                            <td className="py-3 text-center text-text-primary">{t('subscription.table.unlimited')}</td>
                        </tr>
                        <tr className="border-b border-border/50">
                            <td className="py-3 text-text-primary">{t('subscription.table.aiSummaries')}</td>
                            <td className="py-3 text-center"><div className="flex justify-center"><CheckIcon /></div></td>
                            <td className="py-3 text-center"><div className="flex justify-center"><CheckIcon /></div></td>
                        </tr>
                        <tr className="border-b border-border/50">
                            <td className="py-3 text-text-primary">{t('subscription.table.aiTags')}</td>
                            <td className="py-3 text-center"><div className="flex justify-center"><CheckIcon /></div></td>
                            <td className="py-3 text-center"><div className="flex justify-center"><CheckIcon /></div></td>
                        </tr>
                        <tr className="border-b border-border/50">
                            <td className="py-3 text-text-primary">{t('subscription.table.aiChat')}</td>
                            <td className="py-3 text-center"><div className="flex justify-center"><XIcon /></div></td>
                            <td className="py-3 text-center"><div className="flex justify-center"><CheckIcon /></div></td>
                        </tr>
                        <tr className="border-b border-border/50">
                            <td className="py-3 text-text-primary">{t('subscription.table.aiNotes')}</td>
                            <td className="py-3 text-center"><div className="flex justify-center"><XIcon /></div></td>
                            <td className="py-3 text-center"><div className="flex justify-center"><CheckIcon /></div></td>
                        </tr>
                        <tr>
                            <td className="py-3 text-text-primary">{t('subscription.table.support')}</td>
                            <td className="py-3 text-center text-text-secondary">{t('subscription.table.community')}</td>
                            <td className="py-3 text-center text-text-primary">{t('subscription.table.priority')}</td>
                        </tr>
                    </tbody>
                </table>
                </div>
            </div>
        </div>
    );
};
