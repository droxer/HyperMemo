import { corsHeaders } from './cors.ts';

export function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}
