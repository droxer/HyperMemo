/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_SUPABASE_FUNCTION_URL?: string;
  readonly VITE_GOOGLE_OAUTH_CLIENT_ID?: string;
  readonly VITE_AUTO_ANON_LOGIN?: string;
  readonly VITE_AUTH_WAIT_TIMEOUT_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
