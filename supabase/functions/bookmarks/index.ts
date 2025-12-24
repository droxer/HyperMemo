import { handleCors } from '../_shared/cors.ts';
import { jsonResponse } from '../_shared/response.ts';
import { requireUserId, supabaseAdmin } from '../_shared/supabaseClient.ts';
import { readJson, getPathParam } from '../_shared/request.ts';
import { normalizeTags, serializeBookmark } from '../_shared/bookmarks.ts';
import type { BookmarkPayload, BookmarkRow, BookmarkWithTags, Tag } from '../_shared/bookmarks.ts';
import { normalizeTagResult, syncBookmarkTags } from '../_shared/tagUtils.ts';

type BookmarkRecord = Omit<BookmarkRow, 'user_id' | 'created_at' | 'updated_at'> & {
    user_id: string;
    created_at?: string;
    updated_at?: string;
};

type TagAssociationResponse = {
    tags?: Tag[] | Tag | null;
};

type TagAssociationWithBookmark = {
    bookmark_id: string;
    tags?: Tag[] | Tag | null;
};

function ensureTitleUrl(payload: BookmarkPayload): { title: string; url: string } {
    const title = (payload.title ?? '').trim();
    const url = (payload.url ?? '').trim();
    if (!title || !url) {
        throw new Error('title and url are required');
    }
    return { title, url };
}

async function fetchBookmarkWithTags(bookmarkId: string, userId: string): Promise<BookmarkWithTags | null> {
    const { data: bookmark, error: bookmarkError } = await supabaseAdmin
        .from('bookmarks')
        .select('*')
        .eq('id', bookmarkId)
        .eq('user_id', userId)
        .single();

    if (bookmarkError || !bookmark) {
        return null;
    }

    const { data: tagAssociations } = await supabaseAdmin
        .from('bookmark_tags')
        .select('tags(id, user_id, name, created_at)')
        .eq('bookmark_id', bookmarkId);

    const tags: Tag[] = (tagAssociations || [])
        .flatMap((assoc: TagAssociationResponse) => normalizeTagResult(assoc.tags))
        .filter((tag): tag is Tag => Boolean(tag));

    return { ...bookmark, tags } as BookmarkWithTags;
}

async function upsertBookmark(userId: string, payload: BookmarkPayload, existingId?: string): Promise<Response> {
    const { title, url } = ensureTitleUrl(payload);
    const rawContent = (payload.rawContent ?? '').trim();
    const initialSummary = (payload.summary ?? '').trim();
    const initialTags = normalizeTags(payload.tags);

    // Initial embedding (can be improved to be background too, but keeping it simple for now)
    // Actually, let's make embedding background too if it's expensive, but for now let's keep it to ensure search works immediately?
    // No, let's do embedding in background too to make save fast.
    const embedding: number[] | null = null; // Empty initially, will be populated in background

    const record: BookmarkRecord = {
        id: existingId ?? payload.id ?? crypto.randomUUID(),
        user_id: userId,
        title,
        url,
        summary: initialSummary,
        raw_content: rawContent,
        embedding
    };

    // 1. Save initial record
    if (existingId) {
        const { data, error } = await supabaseAdmin
            .from('bookmarks')
            .update({
                title: record.title,
                url: record.url,
                summary: record.summary,
                raw_content: record.raw_content,
                // Don't update embedding yet if it's empty
            })
            .eq('id', existingId)
            .eq('user_id', userId)
            .select()
            .single();
        if (error || !data) throw new Error(error?.message ?? 'Failed to update bookmark');
    } else {
        const { data, error } = await supabaseAdmin.from('bookmarks').insert(record).select().single();
        if (error || !data) throw new Error(error?.message ?? 'Failed to save bookmark');
    }

    // 2. Sync initial tags
    await syncBookmarkTags(record.id, userId, initialTags);

    // 3. Prepare response
    const initialBookmarkWithTags = await fetchBookmarkWithTags(record.id, userId);
    if (!initialBookmarkWithTags) throw new Error('Failed to fetch bookmark');
    return jsonResponse(200, serializeBookmark(initialBookmarkWithTags));
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

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

async function listBookmarks(userId: string, resourceId: string | null, req: Request): Promise<Response> {
    if (resourceId) {
        const bookmarkWithTags = await fetchBookmarkWithTags(resourceId, userId);
        if (!bookmarkWithTags) {
            return jsonResponse(404, { error: 'Bookmark not found' });
        }
        return jsonResponse(200, serializeBookmark(bookmarkWithTags));
    }

    // Parse pagination params from query string
    const url = new URL(req.url);
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') ?? '0', 10) || 0);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));

    // Fetch bookmarks with pagination
    const { data: bookmarks, error, count } = await supabaseAdmin
        .from('bookmarks')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error || !bookmarks) {
        throw new Error(error?.message ?? 'Failed to load bookmarks');
    }

    // Fetch all tags for these bookmarks
    const bookmarkIds = bookmarks.map(b => b.id);
    const { data: tagAssociations } = bookmarkIds.length > 0
        ? await supabaseAdmin
            .from('bookmark_tags')
            .select('bookmark_id, tags(id, user_id, name, created_at)')
            .in('bookmark_id', bookmarkIds)
        : { data: [] };

    // Group tags by bookmark
    const tagsByBookmark = new Map<string, Tag[]>();
    for (const assoc of (tagAssociations || [])) {
        const typedAssoc = assoc as TagAssociationWithBookmark;
        const bookmarkId = typedAssoc.bookmark_id;
        const tags = normalizeTagResult(typedAssoc.tags);
        let bookmarkTags = tagsByBookmark.get(bookmarkId);
        if (!bookmarkTags) {
            bookmarkTags = [];
            tagsByBookmark.set(bookmarkId, bookmarkTags);
        }
        bookmarkTags.push(...tags);
    }

    // Combine bookmarks with their tags
    const bookmarksWithTags: BookmarkWithTags[] = bookmarks.map(bookmark => ({
        ...bookmark,
        tags: tagsByBookmark.get(bookmark.id) || []
    }));

    return jsonResponse(200, {
        data: bookmarksWithTags.map(serializeBookmark),
        pagination: {
            offset,
            limit,
            total: count ?? 0,
            hasMore: offset + limit < (count ?? 0)
        }
    });
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
            return await listBookmarks(userId, resourceId, req);
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
