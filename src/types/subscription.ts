export type SubscriptionTier = 'free' | 'pro';

export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'trial';

export interface Subscription {
    id: string;
    userId: string;
    tier: SubscriptionTier;
    status: SubscriptionStatus;
    startDate: string; // ISO date string
    endDate: string; // ISO date string
    cancelAtPeriodEnd: boolean;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    createdAt: string;
    updatedAt: string;
}

export interface UserProfile {
    id: string;
    email: string;
    subscription: Subscription | null;
    createdAt: string;
}

// Helper functions
export function isSubscriptionActive(subscription: Subscription | null): boolean {
    if (!subscription) return false;
    if (subscription.status !== 'active' && subscription.status !== 'trial') return false;

    const now = new Date();
    const endDate = new Date(subscription.endDate);
    return endDate > now;
}

export function isProUser(subscription: Subscription | null): boolean {
    return subscription?.tier === 'pro' && isSubscriptionActive(subscription);
}

export function getSubscriptionDaysRemaining(subscription: Subscription | null): number {
    if (!subscription) return 0;

    const now = new Date();
    const endDate = new Date(subscription.endDate);
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
}

export function formatSubscriptionPeriod(subscription: Subscription): string {
    const start = new Date(subscription.startDate).toLocaleDateString();
    const end = new Date(subscription.endDate).toLocaleDateString();
    return `${start} - ${end}`;
}
