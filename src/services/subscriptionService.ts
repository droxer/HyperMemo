import { supabase } from './supabaseClient';
import type { Subscription, SubscriptionTier, SubscriptionStatus } from '@/types/subscription';

interface SubscriptionRow {
    id: string;
    user_id: string;
    tier: string;
    status: string;
    start_date: string;
    end_date: string;
    cancel_at_period_end: boolean;
    stripe_customer_id?: string;
    stripe_subscription_id?: string;
    created_at: string;
    updated_at: string;
}

export async function getUserSubscription(userId?: string): Promise<Subscription | null> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const targetUserId = userId || user?.id;

        if (!targetUserId) {
            return null;
        }

        const { data, error } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', targetUserId)
            .maybeSingle();

        if (error) {
            console.error('Error fetching subscription:', error);
            return null;
        }

        return data ? mapSubscriptionFromDb(data) : null;
    } catch (error) {
        console.error('Error in getUserSubscription:', error);
        return null;
    }
}

export async function createProSubscription(
    userId: string,
    durationMonths = 1,
    stripeCustomerId?: string,
    stripeSubscriptionId?: string
): Promise<Subscription | null> {
    try {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + durationMonths);

        const { data, error } = await supabase
            .from('subscriptions')
            .upsert({
                user_id: userId,
                tier: 'pro',
                status: 'active',
                start_date: startDate.toISOString(),
                end_date: endDate.toISOString(),
                stripe_customer_id: stripeCustomerId,
                stripe_subscription_id: stripeSubscriptionId,
                cancel_at_period_end: false
            }, {
                onConflict: 'user_id'
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating pro subscription:', error);
            return null;
        }

        return data ? mapSubscriptionFromDb(data) : null;
    } catch (error) {
        console.error('Error in createProSubscription:', error);
        return null;
    }
}

export async function cancelSubscription(userId: string, immediately = false): Promise<boolean> {
    try {
        const updateData: Record<string, unknown> = {
            cancel_at_period_end: !immediately
        };

        if (immediately) {
            updateData.status = 'cancelled';
        }

        const { error } = await supabase
            .from('subscriptions')
            .update(updateData)
            .eq('user_id', userId);

        if (error) {
            console.error('Error cancelling subscription:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error in cancelSubscription:', error);
        return false;
    }
}

export async function renewSubscription(userId: string, durationMonths = 1): Promise<Subscription | null> {
    try {
        const subscription = await getUserSubscription(userId);

        if (!subscription) {
            return null;
        }

        const now = new Date();
        const currentEndDate = new Date(subscription.endDate);

        // If subscription is still active, extend from current end date
        // Otherwise, start from now
        const startDate = currentEndDate > now ? currentEndDate : now;
        const newEndDate = new Date(startDate);
        newEndDate.setMonth(newEndDate.getMonth() + durationMonths);

        const { data, error } = await supabase
            .from('subscriptions')
            .update({
                status: 'active',
                end_date: newEndDate.toISOString(),
                cancel_at_period_end: false
            })
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            console.error('Error renewing subscription:', error);
            return null;
        }

        return data ? mapSubscriptionFromDb(data) : null;
    } catch (error) {
        console.error('Error in renewSubscription:', error);
        return null;
    }
}

// Helper function to map database response to Subscription type
function mapSubscriptionFromDb(data: SubscriptionRow): Subscription {
    return {
        id: data.id,
        userId: data.user_id,
        tier: data.tier as SubscriptionTier,
        status: data.status as SubscriptionStatus,
        startDate: data.start_date,
        endDate: data.end_date,
        cancelAtPeriodEnd: data.cancel_at_period_end,
        stripeCustomerId: data.stripe_customer_id,
        stripeSubscriptionId: data.stripe_subscription_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at
    };
}
