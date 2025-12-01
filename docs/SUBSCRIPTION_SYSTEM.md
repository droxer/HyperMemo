# Subscription System Documentation

## Overview
HyperMemo implements a robust subscription management system that differentiates between **Free** and **Pro** users. The system is built on Supabase for data persistence and includes frontend components for management and feature gating.

## Data Model

### `subscriptions` Table
Located in Supabase, this table tracks user subscription status.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary Key |
| `user_id` | uuid | Foreign Key to `auth.users` |
| `tier` | text | 'free' or 'pro' |
| `status` | text | 'active', 'expired', 'cancelled', 'trial' |
| `start_date` | timestamptz | Subscription start date |
| `end_date` | timestamptz | Subscription expiration date |
| `stripe_customer_id` | text | For Stripe integration |
| `stripe_subscription_id` | text | For Stripe integration |

**Automation:**
- **New Users**: A database trigger automatically creates a 'free' subscription row when a new user signs up.
- **RLS**: Row Level Security policies ensure users can only read their own subscription data.

## Feature Gating

The application uses a centralized `isPro` check to gate premium features.

### Pro Features
1.  **AI Chat (RAG)**: Chat with your bookmarks using Retrieval-Augmented Generation.
2.  **Auto-Tagging**: AI-powered automatic tagging of bookmarks.
3.  **AI Summaries**: Automatic generation of content summaries.

### Implementation
- **Dashboard**:
    - The `Chat` tab is disabled for free users and shows a "Pro" badge.
    - Clicking restricted features opens a confirmation modal prompting an upgrade.
- **Popup**:
    - Auto-suggest tags and Auto-summarize buttons check for Pro status.
    - Displays a status message if a free user attempts to use them.

## UI Components

### `SubscriptionBadge`
Displays the current user's status in the Dashboard header and Popup.
- **Free**: Gray badge.
- **Pro**: Gold gradient badge.
- **Expired/Warning**: Visual indicators for expired or expiring subscriptions.

### `SubscriptionManager`
A dedicated component (in the Subscription tab) for managing the plan.
- Displays current plan details (dates, status).
- Feature comparison table.
- Upgrade/Downgrade actions (UI placeholders for Stripe integration).

## CLI Management Tool

A CLI script is available for administrators to manually manage subscriptions without direct database access.

**Location**: `scripts/manage-subscription.ts`

**Usage**:
```bash
# View subscription
pnpm run sub get user@example.com

# Set Pro subscription (default 30 days)
pnpm run sub set user@example.com pro

# Set Pro subscription for specific days
pnpm run sub set user@example.com pro 90

# Revert to Free
pnpm run sub set user@example.com free
```

**Requirements**:
- `.env` file must contain `SUPABASE_SECRET_KEY` (Secret Key) for admin access.

## Deployment

When deploying Edge Functions, you must set the secrets in your Supabase project:

```bash
supabase secrets set SUPABASE_SECRET_KEY=your_service_role_key
```

If `SUPABASE_URL` is not automatically available, set it as well:

```bash
supabase secrets set SUPABASE_URL=your_project_url
```

## Future Roadmap
1.  **Stripe Integration**: Connect the backend to Stripe webhooks to automate `tier` and `status` updates upon payment.
2.  **Trial Logic**: Implement automatic 14-day Pro trials for new users.
