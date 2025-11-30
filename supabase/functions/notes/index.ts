import { handleCors } from '../_shared/cors.ts';
import { jsonResponse } from '../_shared/response.ts';
import { requireUserId } from '../_shared/supabaseClient.ts';
import { readJson } from '../_shared/request.ts';

type NotePayload = {
  note?: Record<string, unknown>;
};

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) {
    return cors;
  }
  const url = new URL(req.url);
  const isExportRoute = url.pathname.endsWith('/export');
  if (!isExportRoute || req.method !== 'POST') {
    return jsonResponse(404, { error: 'Not found' });
  }
  try {
    await requireUserId(req);
  } catch (error) {
    return jsonResponse(401, { error: error instanceof Error ? error.message : String(error) });
  }
  const body = (await readJson<NotePayload>(req)) ?? {};
  return jsonResponse(501, {
    error: 'Notes export via Supabase Edge Functions is not implemented yet.',
    note: body.note ?? null
  });
});
