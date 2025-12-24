import { getCorsHeaders, corsHeaders } from './cors.ts';

/**
 * Create a JSON response with CORS headers.
 * @param status HTTP status code
 * @param payload Response body (will be JSON stringified)
 * @param req Optional request for dynamic CORS origin
 */
export function jsonResponse(status: number, payload: unknown, req?: Request): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...(req ? getCorsHeaders(req) : corsHeaders),
      'Content-Type': 'application/json'
    }
  });
}
