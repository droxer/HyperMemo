import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Subscription } from '@/types/subscription';
import { isSubscriptionActive, getSubscriptionDaysRemaining, formatSubscriptionPeriod } from '@/types/subscription';

interface SubscriptionBadgeProps {
    subscription: Subscription | null;
    showDetails?: boolean;
}

export const SubscriptionBadge = memo(function SubscriptionBadge({ subscription, showDetails = false }: SubscriptionBadgeProps) {
    const { t } = useTranslation();

    if (!subscription) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-bg-subtle text-text-secondary rounded-full">
                {t('subscription.badge.free')}
            </span>
        );
    }

    const isActive = isSubscriptionActive(subscription);
    const daysRemaining = getSubscriptionDaysRemaining(subscription);
    const isPro = subscription.tier === 'pro';

    const getBadgeStyles = () => {
        if (!isPro) return 'bg-bg-subtle text-text-secondary';
        if (!isActive) return 'bg-error/10 text-error';
        if (subscription.status === 'trial') return 'bg-primary/10 text-primary';
        if (daysRemaining <= 7) return 'bg-yellow-100 text-yellow-700';
        return 'bg-success/10 text-success';
    };

    const getBadgeText = () => {
        if (!isPro) return t('subscription.badge.free');
        if (!isActive) return t('subscription.badge.proExpired');
        if (subscription.status === 'trial') return t('subscription.badge.proTrial');
        return t('subscription.badge.pro');
    };

    const getStatusIcon = () => {
        if (!isPro) return null;
        if (!isActive) return null;
        if (subscription.status === 'trial') return null;
        if (daysRemaining <= 7) return null;
        return null;
    };

    return (
        <div className="inline-flex flex-col gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${getBadgeStyles()}`}>
                <span>{getBadgeText()}</span>
            </span>

            {showDetails && isPro && (
                <div className="bg-bg-subtle rounded-lg p-3 text-sm">
                    <div className="flex justify-between py-1">
                        <span className="text-text-secondary">{t('subscription.status')}</span>
                        <span className={isActive ? 'text-success' : 'text-error'}>
                            {isActive ? t('subscription.badge.active') : t('subscription.badge.expired')}
                        </span>
                    </div>

                    <div className="flex justify-between py-1">
                        <span className="text-text-secondary">{t('subscription.badge.period')}</span>
                        <span className="text-text-primary">
                            {formatSubscriptionPeriod(subscription)}
                        </span>
                    </div>

                    {isActive && (
                        <div className="flex justify-between py-1">
                            <span className="text-text-secondary">{t('subscription.badge.daysRemaining')}</span>
                            <span className={daysRemaining <= 7 ? 'text-yellow-600' : 'text-text-primary'}>
                                {t('subscription.badge.days', { days: daysRemaining })}
                            </span>
                        </div>
                    )}

                    {subscription.cancelAtPeriodEnd && (
                        <div className="mt-2 px-2 py-1 bg-yellow-50 text-yellow-700 text-xs rounded">
                            {t('subscription.badge.wontRenew')}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});
