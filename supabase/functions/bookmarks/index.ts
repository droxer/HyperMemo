import { handleCors } from '../_shared/cors.ts';
import { jsonResponse } from '../_shared/response.ts';
import { requireUserId, supabaseAdmin } from '../_shared/supabaseClient.ts';
import { readJson, getPathParam } from '../_shared/request.ts';
import { normalizeTags, serializeBookmark } from '../_shared/bookmarks.ts';
import type { BookmarkPayload, BookmarkRow } from '../_shared/bookmarks.ts';
import { computeEmbedding, ensureSummary, ensureTags } from '../_shared/ai.ts';

type BookmarkRecord = Omit<BookmarkRow, 'user_id' | 'created_at' | 'updated_at'> & {
  user_id: string;
  created_at?: string;
  updated_at?: string;
};

function ensureTitleUrl(payload: BookmarkPayload): { title: string; url: string } {
  const title = (payload.title ?? '').trim();
  const url = (payload.url ?? '').trim();
  if (!title || !url) {
    throw new Error('title and url are required');
  }
  return { title, url };
}

async function upsertBookmark(userId: string, payload: BookmarkPayload, existingId?: string): Promise<Response> {
  const { title, url } = ensureTitleUrl(payload);
  const note = (payload.note ?? '').trim();
  const rawContent = (payload.rawContent ?? '').trim();
  let summary = (payload.summary ?? '').trim();
  let tags = normalizeTags(payload.tags);
  summary = await ensureSummary(title, rawContent, url, summary);
  tags = await ensureTags(title, rawContent, tags);
  const embedding = await computeEmbedding([title, summary, note, rawContent]);

  const record: BookmarkRecord = {
    id: existingId ?? payload.id ?? crypto.randomUUID(),
    user_id: userId,
    title,
    url,
    tags,
    summary,
    note,
    raw_content: rawContent,
    embedding
  };

  if (existingId) {
    const { data, error } = await supabaseAdmin
      .from('bookmarks')
      .update({
        title: record.title,
        url: record.url,
        tags: record.tags,
        summary: record.summary,
        note: record.note,
        raw_content: record.raw_content,
        embedding: record.embedding
      })
      .eq('id', existingId)
      .eq('user_id', userId)
      .select()
      .single();
    if (error || !data) {
      throw new Error(error?.message ?? 'Failed to update bookmark');
    }
    return jsonResponse(200, serializeBookmark(data as BookmarkRow));
  }
  const { data, error } = await supabaseAdmin.from('bookmarks').insert(record).select().single();
  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to save bookmark');
  }
  return jsonResponse(200, serializeBookmark(data as BookmarkRow));
}

async function deleteBookmark(userId: string, resourceId: string | null): Promise<Response> {
  if (resourceId) {
    const { error } = await supabaseAdmin
      .from('bookmarks')
      .delete()
      .eq('user_id', userId)
      .eq('id', resourceId);
    if (error) {
      throw new Error(error.message);
    }
    return jsonResponse(200, { success: true });
  }
  const { error } = await supabaseAdmin.from('bookmarks').delete().eq('user_id', userId);
  if (error) {
    throw new Error(error.message);
  }
  return jsonResponse(200, { success: true });
}

async function listBookmarks(userId: string, resourceId: string | null): Promise<Response> {
  let query = supabaseAdmin
    .from('bookmarks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (resourceId) {
    query = query.eq('id', resourceId);
  } else {
    query = query.limit(100);
  }
  const { data, error } = await query;
  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to load bookmarks');
  }
  if (resourceId) {
    const bookmark = data[0];
    if (!bookmark) {
      return jsonResponse(404, { error: 'Bookmark not found' });
    }
    return jsonResponse(200, serializeBookmark(bookmark as BookmarkRow));
  }
  return jsonResponse(
    200,
    data.map((row) => serializeBookmark(row as BookmarkRow))
  );
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) {
    return cors;
  }
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch (error) {
    return jsonResponse(401, { error: error instanceof Error ? error.message : String(error) });
  }
  const resourceId = getPathParam(req, '/bookmarks');
  try {
    if (req.method === 'GET') {
      return await listBookmarks(userId, resourceId);
    }
    if (req.method === 'POST') {
      const body = (await readJson<BookmarkPayload>(req)) ?? {};
      return await upsertBookmark(userId, body);
    }
    if (req.method === 'PUT') {
      const body = (await readJson<BookmarkPayload>(req)) ?? {};
      return await upsertBookmark(userId, body, resourceId ?? body.id);
    }
    if (req.method === 'DELETE') {
      return await deleteBookmark(userId, resourceId);
    }
    return jsonResponse(405, { error: 'Method not allowed' });
  } catch (error) {
    console.error('bookmarks function failed', error);
    return jsonResponse(500, { error: error instanceof Error ? error.message : 'Unknown error' });
  }
});
