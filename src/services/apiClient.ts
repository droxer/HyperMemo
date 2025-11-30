import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/services/supabaseClient';

const SUPABASE_FUNCTION_URL = (import.meta.env.VITE_SUPABASE_FUNCTION_URL ?? '').trim();
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const WAIT_FOR_USER_TIMEOUT_MS = Number(import.meta.env.VITE_AUTH_WAIT_TIMEOUT_MS ?? 5000);

class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function ensureFunctionBaseUrl(): string {
  if (SUPABASE_FUNCTION_URL) {
    return SUPABASE_FUNCTION_URL.replace(/\/$/, '');
  }
  if (!SUPABASE_URL) {
    throw new Error('VITE_SUPABASE_FUNCTION_URL or VITE_SUPABASE_URL must be configured.');
  }
  try {
    const parsed = new URL(SUPABASE_URL);
    const hostnameParts = parsed.hostname.split('.');
    if (hostnameParts.length >= 3 && hostnameParts.at(-2) === 'supabase' && hostnameParts.at(-1) === 'co') {
      const projectRef = hostnameParts[0];
      return `${parsed.protocol}//${projectRef}.functions.supabase.co`;
    }
    if (SUPABASE_FUNCTION_URL) {
      return SUPABASE_FUNCTION_URL.replace(/\/$/, '');
    }
    throw new Error('Unable to derive Supabase Functions URL from custom domain; set VITE_SUPABASE_FUNCTION_URL explicitly.');
  } catch (error) {
    throw new Error(`Invalid Supabase URL. Set VITE_SUPABASE_FUNCTION_URL explicitly. ${String(error)}`);
  }
}

let sessionWaitPromise: Promise<Session | null> | null = null;

async function waitForSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.warn('Failed to read Supabase session', error);
  }
  if (data.session) {
    return data.session;
  }
  if (!sessionWaitPromise) {
    sessionWaitPromise = new Promise<Session | null>((resolve) => {
      let resolved = false;
      let timeoutId: number | undefined;
      const {
        data: { subscription }
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session && !resolved) {
          resolved = true;
          if (timeoutId !== undefined) {
            clearTimeout(timeoutId);
          }
          subscription.unsubscribe();
          resolve(session);
        }
      });
      timeoutId = window.setTimeout(() => {
        if (!resolved) {
          resolved = true;
          subscription.unsubscribe();
          resolve(null);
        }
      }, WAIT_FOR_USER_TIMEOUT_MS);
    }).finally(() => {
      sessionWaitPromise = null;
    });
  }
  return sessionWaitPromise;
}

async function authHeaders(): Promise<Headers> {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const session = await waitForSession();
  const token = session?.access_token;
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  } else {
    console.warn('Missing Supabase access token; request will be anonymous.');
  }
  return headers;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = ensureFunctionBaseUrl();
  const auth = await authHeaders();
  const requestHeaders = new Headers(init?.headers || {});
  auth.forEach((value, key) => requestHeaders.set(key, value));
  
  const url = `${baseUrl}${path}`;
  console.debug('API request:', { method: init?.method || 'GET', url, hasAuth: requestHeaders.has('Authorization') });
  
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: requestHeaders
    });
  } catch (error) {
    console.error('Network error during fetch:', error);
    throw new ApiError(
      error instanceof Error ? error.message : 'Network error',
      0,
      { error: 'Failed to connect to server' }
    );
  }
  
  const text = await response.text();
  let payload: T | undefined;
  if (text) {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      try {
        payload = JSON.parse(text) as T;
      } catch (error) {
        console.warn('Failed to parse JSON response', error, text);
        payload = undefined;
      }
    } else {
      payload = text as unknown as T;
    }
  }
  
  if (!response.ok) {
    console.error('API error response:', {
      status: response.status,
      statusText: response.statusText,
      body: payload,
      url
    });
    throw new ApiError(response.statusText || 'API request failed', response.status, payload);
  }
  
  return payload as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined
    }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' })
};

export { ApiError };
