import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();

function assertEnv(value: string, name: string): string {
    if (!value) {
        throw new Error(`Missing ${name} environment variable.`);
    }
    return value;
}

export const supabase = createClient(assertEnv(supabaseUrl, 'VITE_SUPABASE_URL'), assertEnv(supabaseAnonKey, 'VITE_SUPABASE_PUBLISHABLE_KEY'), {
    auth: {
        detectSessionInUrl: false,
        persistSession: true,
        autoRefreshToken: true
    }
});

export type SupabaseBrowserClient = SupabaseClient;
