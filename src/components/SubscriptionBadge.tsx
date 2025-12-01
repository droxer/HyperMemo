import type React from 'react';
import type { Subscription } from '@/types/subscription';
import { isSubscriptionActive, getSubscriptionDaysRemaining, formatSubscriptionPeriod } from '@/types/subscription';
import './SubscriptionBadge.css';

interface SubscriptionBadgeProps {
    subscription: Subscription | null;
    showDetails?: boolean;
}

export const SubscriptionBadge: React.FC<SubscriptionBadgeProps> = ({ subscription, showDetails = false }) => {
    if (!subscription) {
        return (
            <span className="subscription-badge subscription-badge--free">
                Free
            </span>
        );
    }

    const isActive = isSubscriptionActive(subscription);
    const daysRemaining = getSubscriptionDaysRemaining(subscription);
    const isPro = subscription.tier === 'pro';

    const getBadgeClass = () => {
        if (!isPro) return 'subscription-badge--free';
        if (!isActive) return 'subscription-badge--expired';
        if (subscription.status === 'trial') return 'subscription-badge--trial';
        if (daysRemaining <= 7) return 'subscription-badge--expiring';
        return 'subscription-badge--pro';
    };

    const getBadgeText = () => {
        if (!isPro) return 'Free';
        if (!isActive) return 'Pro (Expired)';
        if (subscription.status === 'trial') return 'Pro (Trial)';
        return 'Pro';
    };

    const getStatusIcon = () => {
        if (!isPro) return '🆓';
        if (!isActive) return '⚠️';
        if (subscription.status === 'trial') return '🎁';
        if (daysRemaining <= 7) return '⏰';
        return '⭐';
    };

    return (
        <div className="subscription-badge-container">
            <span className={`subscription-badge ${getBadgeClass()}`}>
                <span className="subscription-badge__icon">{getStatusIcon()}</span>
                <span className="subscription-badge__text">{getBadgeText()}</span>
            </span>

            {showDetails && isPro && (
                <div className="subscription-details">
                    <div className="subscription-details__row">
                        <span className="subscription-details__label">Status:</span>
                        <span className={`subscription-details__value ${isActive ? 'active' : 'inactive'}`}>
                            {isActive ? 'Active' : 'Expired'}
                        </span>
                    </div>

                    <div className="subscription-details__row">
                        <span className="subscription-details__label">Period:</span>
                        <span className="subscription-details__value">
                            {formatSubscriptionPeriod(subscription)}
                        </span>
                    </div>

                    {isActive && (
                        <div className="subscription-details__row">
                            <span className="subscription-details__label">Days Remaining:</span>
                            <span className={`subscription-details__value ${daysRemaining <= 7 ? 'warning' : ''}`}>
                                {daysRemaining} days
                            </span>
                        </div>
                    )}

                    {subscription.cancelAtPeriodEnd && (
                        <div className="subscription-details__warning">
                            ⚠️ Subscription will not renew
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
