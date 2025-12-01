-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tier TEXT NOT NULL CHECK (tier IN ('free', 'pro')) DEFAULT 'free',
    status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'cancelled', 'trial')) DEFAULT 'active',
    start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_date TIMESTAMPTZ NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);

-- Enable Row Level Security
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own subscription
-- Policy: Users can view their own subscription
DROP POLICY IF EXISTS "Users can view own subscription" ON subscriptions;
CREATE POLICY "Users can view own subscription"
    ON subscriptions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Service role can manage all subscriptions
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON subscriptions;
CREATE POLICY "Service role can manage subscriptions"
    ON subscriptions
    FOR ALL
    USING (auth.role() = 'service_role');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to create default free subscription for new users
CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO subscriptions (user_id, tier, status, start_date, end_date)
    VALUES (
        NEW.id,
        'free',
        'active',
        NOW(),
        NOW() + INTERVAL '100 years' -- Free tier never expires
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create subscription when user signs up
-- Trigger to create subscription when user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_subscription();

-- Function to check if subscription is expired and update status
CREATE OR REPLACE FUNCTION check_expired_subscriptions()
RETURNS void AS $$
BEGIN
    UPDATE subscriptions
    SET status = 'expired'
    WHERE status IN ('active', 'trial')
    AND end_date < NOW()
    AND tier = 'pro';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to check for expired subscriptions (run daily)
-- Note: This requires pg_cron extension
-- SELECT cron.schedule('check-expired-subscriptions', '0 0 * * *', 'SELECT check_expired_subscriptions()');
