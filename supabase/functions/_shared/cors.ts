import { ALLOWED_ORIGINS } from './env.ts';

/**
 * Get CORS headers based on request origin.
 * If ALLOWED_ORIGINS is set, only allow those origins.
 * Otherwise, allow all origins (for development).
 */
export function getCorsHeaders(req?: Request): HeadersInit {
  let allowedOrigin = '*';

  if (ALLOWED_ORIGINS) {
    const origins = ALLOWED_ORIGINS.split(',').map(o => o.trim());
    const requestOrigin = req?.headers.get('origin') ?? '';

    if (origins.includes(requestOrigin)) {
      allowedOrigin = requestOrigin;
    } else if (origins.length > 0) {
      // If origin not in allowed list, use first allowed origin
      // This prevents access from unauthorized origins
      allowedOrigin = origins[0];
    }
  }

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  };
}

// For backwards compatibility
export const corsHeaders: HeadersInit = getCorsHeaders();

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }
  return null;
}
