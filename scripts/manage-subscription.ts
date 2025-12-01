import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simple .env parser
function loadEnv() {
    try {
        const envPath = resolve(process.cwd(), '.env');
        const envFile = readFileSync(envPath, 'utf8');
        const lines = envFile.split('\n');
        for (const line of lines) {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes
                process.env[key] = value;
            }
        }
    } catch (e) {
        console.warn('Warning: .env file not found or unreadable');
    }
}

loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    console.error('Error: VITE_SUPABASE_URL and SUPABASE_SECRET_KEY are required in .env');
    console.error('Please add SUPABASE_SECRET_KEY to your .env file (find it in Supabase Dashboard > Project Settings > API)');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function getUserByEmail(email: string) {
    // Note: listUsers is not efficient for large user bases, but fine for CLI admin tools
    // In a real prod env with millions of users, you'd want a more direct query or search
    const { data, error } = await supabase.auth.admin.listUsers();

    if (error) throw error;

    const user = data.users.find(u => u.email === email);
    return user;
}

async function getSubscription(email: string) {
    const user = await getUserByEmail(email);
    if (!user) {
        console.error(`User with email ${email} not found`);
        return;
    }

    const { data: sub, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

    if (error) {
        console.error('Error fetching subscription:', error.message);
        return;
    }

    if (!sub) {
        console.log(`No subscription found for user ${email}`);
        return;
    }

    console.log('\nSubscription Details:');
    console.log('---------------------');
    console.log(`User: ${email}`);
    console.log(`Tier: ${sub.tier}`);
    console.log(`Status: ${sub.status}`);
    console.log(`Start Date: ${new Date(sub.start_date).toLocaleDateString()}`);
    console.log(`End Date: ${new Date(sub.end_date).toLocaleDateString()}`);
    console.log(`Days Remaining: ${Math.ceil((new Date(sub.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))}`);
}

async function setSubscription(email: string, tier: 'free' | 'pro', days = 30) {
    const user = await getUserByEmail(email);
    if (!user) {
        console.error(`User with email ${email} not found`);
        return;
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + Number.parseInt(String(days)));

    const { error } = await supabase
        .from('subscriptions')
        .upsert({
            user_id: user.id,
            tier,
            status: 'active',
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

    if (error) {
        console.error('Error updating subscription:', error.message);
        return;
    }

    console.log(`Successfully set ${tier} subscription for ${email} for ${days} days.`);
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    try {
        switch (command) {
            case 'get':
                if (!args[1]) throw new Error('Email required');
                await getSubscription(args[1]);
                break;

            case 'set':
                if (!args[1] || !args[2]) throw new Error('Usage: set <email> <tier> [days]');
                if (args[2] !== 'free' && args[2] !== 'pro') throw new Error('Tier must be "free" or "pro"');
                await setSubscription(args[1], args[2] as 'free' | 'pro', args[3] ? Number.parseInt(args[3]) : 30);
                break;

            default:
                console.log('HyperMemo Subscription CLI');
                console.log('--------------------------');
                console.log('Usage:');
                console.log('  npx tsx scripts/manage-subscription.ts get <email>');
                console.log('  npx tsx scripts/manage-subscription.ts set <email> <tier> [days]');
                break;
        }
    } catch (error) {
        if (error instanceof Error) {
            console.error('Error:', error.message);
        } else {
            console.error('Error:', String(error));
        }
        process.exit(1);
    }
}

main();
