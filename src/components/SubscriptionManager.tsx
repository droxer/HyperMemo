import { type FC, useEffect, useState } from 'react';
import type { Subscription } from '@/types/subscription';
import { getUserSubscription } from '@/services/subscriptionService';
import { isProUser, getSubscriptionDaysRemaining, formatSubscriptionPeriod } from '@/types/subscription';
import './SubscriptionManager.css';

const CheckIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#059669' }}>
        <title>Included</title>
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const XIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#94a3b8' }}>
        <title>Not Included</title>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

export const SubscriptionManager: FC = () => {
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSubscription();
    }, []);

    const loadSubscription = async () => {
        setLoading(true);
        const sub = await getUserSubscription();
        setSubscription(sub);
        setLoading(false);
    };

    const isPro = isProUser(subscription);
    const daysRemaining = getSubscriptionDaysRemaining(subscription);

    if (loading) {
        return (
            <div className="subscription-manager">
                <div className="subscription-manager__loading">
                    <div className="spinner" />
                    <span>Loading subscription details...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="subscription-manager">
            <div className="subscription-manager__header">
                <div>
                    <h2>Subscription & Billing</h2>
                    <p style={{ margin: '0.5rem 0 0', color: '#64748b' }}>Manage your plan and billing details</p>
                </div>
            </div>

            <div className="subscription-manager__content">
                {!isPro ? (
                    <div className="subscription-plan subscription-plan--pro">
                        <div className="subscription-plan__header">
                            <div>
                                <h3>Upgrade to Pro</h3>
                                <p style={{ color: '#64748b', margin: 0 }}>Unlock the full power of HyperMemo</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <p className="subscription-plan__price">$4.99<span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 500 }}>/mo</span></p>
                            </div>
                        </div>

                        <div className="subscription-plan__features">
                            <h4>What's included:</h4>
                            <ul>
                                <li><CheckIcon /> <span><strong>AI-Powered Summaries</strong> - Instantly summarize any article</span></li>
                                <li><CheckIcon /> <span><strong>Smart Auto-Tagging</strong> - Organize your bookmarks automatically</span></li>
                                <li><CheckIcon /> <span><strong>RAG Chat Assistant</strong> - Chat with your knowledge base</span></li>
                                <li><CheckIcon /> <span><strong>Unlimited Bookmarks</strong> - Save as much as you want</span></li>
                                <li><CheckIcon /> <span><strong>Google Docs Export</strong> - Turn research into documents</span></li>
                                <li><CheckIcon /> <span><strong>Priority Support</strong> - Get help when you need it</span></li>
                            </ul>
                        </div>

                        <button className="btn-upgrade" disabled type="button">
                            Upgrade to Pro
                            <span className="badge-coming-soon">Coming Soon</span>
                        </button>
                        <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.875rem', color: '#64748b' }}>
                            Secure payment via Stripe • Cancel anytime
                        </p>
                    </div>
                ) : (
                    <div className="subscription-plan subscription-plan--pro">
                        <div className="subscription-plan__header">
                            <div>
                                <h3>Pro Plan Active</h3>
                                <p style={{ color: '#64748b', margin: 0 }}>Thank you for supporting HyperMemo!</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span className="status-pill status-pill--active">Active</span>
                            </div>
                        </div>

                        <div className="subscription-details-grid">
                            <div className="detail-item">
                                <span className="detail-label">Current Period</span>
                                <span className="detail-value">{subscription ? formatSubscriptionPeriod(subscription) : '-'}</span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">Status</span>
                                <span className="detail-value" style={{ color: '#059669' }}>Active</span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">Next Billing</span>
                                <span className="detail-value">
                                    {subscription?.cancelAtPeriodEnd ? 'Ends on ' : 'Renews on '}
                                    {subscription ? new Date(subscription.endDate).toLocaleDateString() : '-'}
                                </span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">Plan Cost</span>
                                <span className="detail-value">$4.99/month</span>
                            </div>
                        </div>

                        {daysRemaining <= 7 && daysRemaining > 0 && (
                            <div className="subscription-warning">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <title>Warning</title>
                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                    <line x1="12" y1="9" x2="12" y2="13" />
                                    <line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                                <span>Your subscription expires in {daysRemaining} days</span>
                            </div>
                        )}

                        {subscription?.cancelAtPeriodEnd && (
                            <div className="subscription-warning">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <title>Info</title>
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                <span>Your subscription is set to cancel at the end of the period</span>
                            </div>
                        )}

                        <div className="subscription-actions">
                            <button className="btn-secondary" disabled type="button">
                                Manage Billing
                                <span className="badge-coming-soon">Coming Soon</span>
                            </button>
                            {!subscription?.cancelAtPeriodEnd && (
                                <button className="btn-danger" disabled type="button">
                                    Cancel Subscription
                                    <span className="badge-coming-soon">Coming Soon</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}

                <div className="subscription-comparison">
                    <h3>Plan Comparison</h3>
                    <table className="comparison-table">
                        <thead>
                            <tr>
                                <th>Feature</th>
                                <th>Free</th>
                                <th>Pro</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Bookmarks</td>
                                <td>Unlimited</td>
                                <td>Unlimited</td>
                            </tr>
                            <tr>
                                <td>AI Summaries</td>
                                <td><XIcon /></td>
                                <td><CheckIcon /></td>
                            </tr>
                            <tr>
                                <td>Smart Tags</td>
                                <td><XIcon /></td>
                                <td><CheckIcon /></td>
                            </tr>
                            <tr>
                                <td>RAG Chat</td>
                                <td><XIcon /></td>
                                <td><CheckIcon /></td>
                            </tr>
                            <tr>
                                <td>Export to Docs</td>
                                <td><XIcon /></td>
                                <td><CheckIcon /></td>
                            </tr>
                            <tr>
                                <td>Support</td>
                                <td>Community</td>
                                <td>Priority</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
