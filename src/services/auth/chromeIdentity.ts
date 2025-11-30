import { supabase } from '@/services/supabaseClient';

const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID ?? '';

const GOOGLE_OAUTH_SCOPES = ['openid', 'email', 'profile'];

function generateNonce(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const array = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < array.length; i += 1) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashNonce(value: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return value;
  }
  try {
    const data = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const bytes = new Uint8Array(digest);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    if (typeof btoa !== 'function') {
      return value;
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (error) {
    console.warn('Failed to hash nonce, falling back to raw nonce', error);
    return value;
  }
}

function ensureChromeIdentity(): typeof chrome.identity {
  if (typeof chrome === 'undefined' || !chrome.identity) {
    throw new Error('Chrome identity API is unavailable in this context.');
  }
  return chrome.identity;
}

function ensureClientId(): string {
  if (!clientId) {
    throw new Error('Missing VITE_GOOGLE_OAUTH_CLIENT_ID env variable.');
  }
  return clientId;
}

type ChromeIdentityResult = {
  responseUrl: string;
  nonce: string;
};

async function runWebAuthFlow(): Promise<ChromeIdentityResult> {
  const identity = ensureChromeIdentity();
  const redirectUri = identity.getRedirectURL();
  if (import.meta.env.DEV) {
    console.log('[HyperMemo] Chrome Identity redirect URL:', redirectUri);
  }
  const nonce = await hashNonce(generateNonce());
  const params = new URLSearchParams({
    client_id: ensureClientId(),
    response_type: 'token id_token',
    redirect_uri: redirectUri,
    scope: GOOGLE_OAUTH_SCOPES.join(' '),
    prompt: 'select_account',
    include_granted_scopes: 'true',
    nonce,
    state: generateNonce()
  });
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return new Promise((resolve, reject) => {
    identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (responseUrl) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!responseUrl) {
        reject(new Error('Google OAuth cancelled.'));
        return;
      }
      resolve({ responseUrl, nonce });
    });
  });
}

function decodeJWT(token: string): { nonce?: string; [key: string]: unknown } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }
    const payload = parts[1];
    // Base64URL decode: replace URL-safe characters and add padding if needed
    let base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padding = base64.length % 4;
    if (padding) {
      base64 += '='.repeat(4 - padding);
    }
    const decoded = JSON.parse(atob(base64));
    return decoded;
  } catch (error) {
    console.warn('Failed to decode ID token', error);
    return {};
  }
}

function extractTokens(responseUrl: string): { idToken: string; accessToken: string | null; nonce?: string } {
  const fragment = responseUrl.split('#')[1] ?? '';
  const params = new URLSearchParams(fragment);
  const idToken = params.get('id_token');
  if (!idToken) {
    throw new Error('Google OAuth missing id_token.');
  }
  const decoded = decodeJWT(idToken);
  return {
    idToken,
    accessToken: params.get('access_token'),
    nonce: decoded.nonce as string | undefined
  };
}

export async function loginWithChromeIdentity(): Promise<void> {
  const { responseUrl, nonce: generatedNonce } = await runWebAuthFlow();
  const { idToken, nonce: tokenNonce } = extractTokens(responseUrl);
  const nonceToUse = tokenNonce ?? generatedNonce ?? undefined;
  if (import.meta.env.DEV) {
    console.log('[HyperMemo] Nonce handling:', { 
      tokenNonce, 
      generatedNonce, 
      using: nonceToUse,
      hasTokenNonce: !!tokenNonce
    });
  }
  
  // Build the sign-in options - only include nonce if we have one
  const signInOptions: { provider: string; token: string; nonce?: string } = {
    provider: 'google',
    token: idToken
  };
  
  if (nonceToUse) {
    signInOptions.nonce = nonceToUse;
  }
  
  const { error } = await supabase.auth.signInWithIdToken(signInOptions);
  if (error) {
    throw error;
  }
}
