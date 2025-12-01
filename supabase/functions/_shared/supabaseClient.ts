import { createClient } from '@supabase/supabase-js';
import { ANON_UID, REQUIRE_AUTH, SERVICE_ROLE_KEY } from './env.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';

if (!supabaseUrl || !SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SERVICE_ROLE_KEY must be configured for Edge Functions.');
}

export const supabaseAdmin = createClient(supabaseUrl, SERVICE_ROLE_KEY);

function extractBearer(req: Request): string | null {
    const header = req.headers.get('Authorization') ?? req.headers.get('authorization') ?? '';
    if (!header.toLowerCase().startsWith('bearer ')) {
        return null;
    }
    const token = header.slice(7).trim();
    return token || null;
}

export async function requireUserId(req: Request): Promise<string> {
    if (!REQUIRE_AUTH) {
        return ANON_UID;
    }
    const token = extractBearer(req);
    if (!token) {
        throw new Error('Missing Authorization bearer token');
    }
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
        throw new Error('Invalid or expired access token');
    }
    return data.user.id;
}
