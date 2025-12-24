export const AI_PROVIDER = (Deno.env.get('AI_PROVIDER') ?? 'openai').trim().toLowerCase();
export const REQUIRE_AUTH = !['0', 'false', 'no', 'off'].includes(
  (Deno.env.get('REQUIRE_AUTH') ?? 'true').trim().toLowerCase()
);
export const ANON_UID = Deno.env.get('ANON_UID') ?? 'dev-anon';
export const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
export const OPENAI_BASE_URL = Deno.env.get('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1';
export const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini';
export const OPENAI_EMBED_MODEL =
  Deno.env.get('OPENAI_EMBEDDING_MODEL') ?? 'text-embedding-3-small';

export const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') ?? '';
export const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') ?? '';
export const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS') ?? '';

export function assertEnv(value: string, name: string): string {
  if (!value) {
    throw new Error(`Missing ${name} environment variable`);
  }
  return value;
}

/**
 * Validate required environment variables at startup.
 * Call this at the beginning of each Edge Function.
 */
export function validateRequiredEnv(): void {
  const required: Array<[string, string]> = [
    [OPENAI_API_KEY, 'OPENAI_API_KEY'],
  ];

  for (const [value, name] of required) {
    if (!value) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
  }
}
