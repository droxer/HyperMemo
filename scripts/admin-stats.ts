import { createClient, User } from '@supabase/supabase-js';
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

interface AppData {
    users: User[];
    subscriptions: any[];
}

async function fetchData(): Promise<AppData> {
    console.log('Fetching data...');

    // 1. Fetch Users
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) throw usersError;

    // 2. Fetch Subscriptions
    const { data: subscriptions, error: subsError } = await supabase
        .from('subscriptions')
        .select('*');
    if (subsError) throw subsError;

    return { users, subscriptions: subscriptions || [] };
}

function formatDate(dateStr: string | undefined) {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
}

async function showGrowthStats(data: AppData) {
    const { users } = data;
    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    const sevenDays = 7 * oneDay;
    const thirtyDays = 30 * oneDay;

    const newUsers24h = users.filter(u => new Date(u.created_at).getTime() > now.getTime() - oneDay).length;
    const newUsers7d = users.filter(u => new Date(u.created_at).getTime() > now.getTime() - sevenDays).length;
    const newUsers30d = users.filter(u => new Date(u.created_at).getTime() > now.getTime() - thirtyDays).length;

    console.log('\n📈 User Growth Statistics');
    console.log('=======================');
    console.table({
        'Total Users': users.length,
        'New (24h)': newUsers24h,
        'New (7d)': newUsers7d,
        'New (30d)': newUsers30d
    });

    console.log('\n🆕 Most Recent Users (Top 10)');
    const recentUsers = [...users]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10)
        .map(u => ({
            Email: u.email,
            'Created At': formatDate(u.created_at),
            'Last Sign In': formatDate(u.last_sign_in_at),
            Provider: u.app_metadata.provider || 'email'
        }));
    console.table(recentUsers);
}

async function showActiveStats(data: AppData) {
    const { users } = data;
    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    const sevenDays = 7 * oneDay;
    const thirtyDays = 30 * oneDay;

    const activeUsers24h = users.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at).getTime() > now.getTime() - oneDay).length;
    const activeUsers7d = users.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at).getTime() > now.getTime() - sevenDays).length;
    const activeUsers30d = users.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at).getTime() > now.getTime() - thirtyDays).length;

    console.log('\nactivity User Activity Statistics');
    console.log('=============================');
    console.table({
        'Active (24h)': activeUsers24h,
        'Active (7d)': activeUsers7d,
        'Active (30d)': activeUsers30d
    });

    console.log('\n⚡️ Most Recently Active Users (Top 10)');
    const activeUsers = [...users]
        .filter(u => u.last_sign_in_at)
        .sort((a, b) => new Date(b.last_sign_in_at!).getTime() - new Date(a.last_sign_in_at!).getTime())
        .slice(0, 10)
        .map(u => ({
            Email: u.email,
            'Last Sign In': formatDate(u.last_sign_in_at),
            'Created At': formatDate(u.created_at),
            'Sign In Count': u.last_sign_in_at ? 'Yes' : 'No' // Supabase doesn't expose sign in count directly in basic user object easily without metadata
        }));
    console.table(activeUsers);
}

async function showSubscriptionStats(data: AppData) {
    const { users, subscriptions } = data;
    const now = new Date();

    const proSubs = subscriptions.filter(s => s.tier === 'pro' && s.status === 'active');
    const freeSubs = subscriptions.filter(s => s.tier === 'free' && s.status === 'active');
    const expiredProSubs = subscriptions.filter(s => s.tier === 'pro' && s.status === 'active' && new Date(s.end_date) < now);

    console.log('\n💳 Subscription Statistics');
    console.log('========================');
    console.table({
        'Total Subscriptions': subscriptions.length,
        'Pro (Active)': proSubs.length,
        'Free (Active)': freeSubs.length,
        'Expired Pro (Anomalies)': expiredProSubs.length
    });

    if (proSubs.length > 0) {
        console.log('\n💎 Pro Users List');
        const proUsersList = proSubs.map(sub => {
            const user = users.find(u => u.id === sub.user_id);
            return {
                Email: user?.email || 'Unknown',
                'Start Date': formatDate(sub.start_date),
                'End Date': formatDate(sub.end_date),
                'Auto Renew': sub.cancel_at_period_end ? 'No' : 'Yes'
            };
        });
        console.table(proUsersList);
    } else {
        console.log('\nNo active Pro subscriptions found.');
    }

    if (expiredProSubs.length > 0) {
        console.log('\n⚠️ Expired Pro Subscriptions (Status is Active but Date Passed)');
        const expiredList = expiredProSubs.map(sub => {
            const user = users.find(u => u.id === sub.user_id);
            return {
                Email: user?.email || 'Unknown',
                'End Date': formatDate(sub.end_date),
                'Days Overdue': Math.floor((now.getTime() - new Date(sub.end_date).getTime()) / (1000 * 60 * 60 * 24))
            };
        });
        console.table(expiredList);
    }
}

async function showSummary(data: AppData) {
    const { users, subscriptions } = data;
    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;

    const newUsers24h = users.filter(u => new Date(u.created_at).getTime() > now.getTime() - oneDay).length;
    const activeUsers24h = users.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at).getTime() > now.getTime() - oneDay).length;
    const proSubs = subscriptions.filter(s => s.tier === 'pro' && s.status === 'active').length;

    console.log('\n📊 Dashboard Summary');
    console.log('===================');
    console.table({
        'Total Users': users.length,
        'New Users (24h)': newUsers24h,
        'Active Users (24h)': activeUsers24h,
        'Pro Subscriptions': proSubs
    });
    console.log('\nTip: Run with "grow", "active", or "subscription" for more details.');
}

async function main() {
    try {
        const args = process.argv.slice(2);
        const command = args[0];

        const data = await fetchData();

        switch (command) {
            case 'grow':
                await showGrowthStats(data);
                break;
            case 'active':
                await showActiveStats(data);
                break;
            case 'subscription':
                await showSubscriptionStats(data);
                break;
            default:
                await showSummary(data);
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
