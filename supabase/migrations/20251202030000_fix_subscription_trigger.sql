-- Fix the subscription trigger to handle errors gracefully
-- This prevents "Database error saving new user" when the trigger fails

-- Drop and recreate the function with better error handling
CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Use INSERT ... ON CONFLICT to avoid duplicate key errors
    INSERT INTO subscriptions (user_id, tier, status, start_date, end_date)
    VALUES (
        NEW.id,
        'free',
        'active',
        NOW(),
        NOW() + INTERVAL '100 years' -- Free tier never expires
    )
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail the user creation
        RAISE WARNING 'Failed to create default subscription for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_subscription();
