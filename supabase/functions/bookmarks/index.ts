import { handleCors } from '../_shared/cors.ts';
import { jsonResponse } from '../_shared/response.ts';
import { requireUserId, supabaseAdmin } from '../_shared/supabaseClient.ts';
import { readJson, getPathParam } from '../_shared/request.ts';
import { normalizeTags, serializeBookmark } from '../_shared/bookmarks.ts';
import type { BookmarkPayload, BookmarkRow, BookmarkWithTags, Tag } from '../_shared/bookmarks.ts';
import { computeEmbedding, ensureSummary, ensureTags } from '../_shared/ai.ts';
import { normalizeTagResult } from '../_shared/tagUtils.ts';

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

async function getOrCreateTag(userId: string, tagName: string): Promise<string> {
    const { data: existingTag } = await supabaseAdmin
        .from('tags')
        .select('id')
        .eq('user_id', userId)
        .eq('name', tagName)
        .single();

    if (existingTag) {
        return existingTag.id;
    }

    const { data: newTag, error } = await supabaseAdmin
        .from('tags')
        .insert({ user_id: userId, name: tagName })
        .select('id')
        .single();

    if (error || !newTag) {
        throw new Error(`Failed to create tag: ${error?.message}`);
    }

    return newTag.id;
}

type BookmarkTagAssociation = {
    tag_id: string;
    tags?: Array<{
        name: string;
    }> | {
        name: string;
    } | null;
};

type TagAssociationResponse = {
    tags?: Tag[] | Tag | null;
};

type TagAssociationWithBookmark = {
    bookmark_id: string;
    tags?: Tag[] | Tag | null;
};

function normalizeTagResult<T>(value: T[] | T | null | undefined): T[] {
    if (Array.isArray(value)) {
        return value;
    }
    if (value) {
        return [value];
    }
    return [];
}

async function syncBookmarkTags(bookmarkId: string, userId: string, tagNames: string[]): Promise<void> {
    // Get current tag associations
    const { data: currentAssociations } = await supabaseAdmin
        .from('bookmark_tags')
        .select('tag_id, tags!inner(name)')
        .eq('bookmark_id', bookmarkId);

    const currentTagNames = new Set(
        (currentAssociations || [])
            .map((assoc: BookmarkTagAssociation) => normalizeTagResult(assoc.tags)[0]?.name)
            .filter((name): name is string => Boolean(name))
    );
    const newTagNames = new Set(tagNames);

    // Find tags to add and remove
    const tagsToAdd = tagNames.filter(name => !currentTagNames.has(name));
    const tagsToRemove = (currentAssociations || [])
        .filter((assoc: BookmarkTagAssociation) => {
            const assocTags = normalizeTagResult(assoc.tags);
            return assocTags[0] && !newTagNames.has(assocTags[0].name);
        })
        .map((assoc: BookmarkTagAssociation) => assoc.tag_id);

    // Remove old associations
    if (tagsToRemove.length > 0) {
        await supabaseAdmin
            .from('bookmark_tags')
            .delete()
            .eq('bookmark_id', bookmarkId)
            .in('tag_id', tagsToRemove);
    }

    // Add new associations
    for (const tagName of tagsToAdd) {
        const tagId = await getOrCreateTag(userId, tagName);
        await supabaseAdmin
            .from('bookmark_tags')
            .insert({ bookmark_id: bookmarkId, tag_id: tagId });
    }
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
    let summary = (payload.summary ?? '').trim();
    let tags = normalizeTags(payload.tags);
    summary = await ensureSummary(title, rawContent, url, summary);
    tags = await ensureTags(title, rawContent, tags);

    let embedding: number[] = [];

    if (existingId) {
        const { data: existingRecord } = await supabaseAdmin
            .from('bookmarks')
            .select('title, summary, raw_content, embedding')
            .eq('id', existingId)
            .eq('user_id', userId)
            .single();

        const contentChanged = !existingRecord ||
            existingRecord.title !== title ||
            (existingRecord.summary ?? '') !== summary ||
            (existingRecord.raw_content ?? '') !== rawContent;

        if (!contentChanged && existingRecord?.embedding) {
            embedding = existingRecord.embedding;
        } else {
            embedding = await computeEmbedding([title, summary, rawContent]);
        }
    } else {
        embedding = await computeEmbedding([title, summary, rawContent]);
    }

    const record: BookmarkRecord = {
        id: existingId ?? payload.id ?? crypto.randomUUID(),
        user_id: userId,
        title,
        url,
        summary,
        raw_content: rawContent,
        embedding
    };

    if (existingId) {
        const { data, error } = await supabaseAdmin
            .from('bookmarks')
            .update({
                title: record.title,
                url: record.url,
                summary: record.summary,
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

        // Sync tags
        await syncBookmarkTags(existingId, userId, tags);

        // Fetch with tags
        const bookmarkWithTags = await fetchBookmarkWithTags(existingId, userId);
        if (!bookmarkWithTags) {
            throw new Error('Failed to fetch updated bookmark');
        }
        return jsonResponse(200, serializeBookmark(bookmarkWithTags));
    }

    const { data, error } = await supabaseAdmin.from('bookmarks').insert(record).select().single();
    if (error || !data) {
        throw new Error(error?.message ?? 'Failed to save bookmark');
    }

    // Sync tags for new bookmark
    await syncBookmarkTags(record.id, userId, tags);

    // Fetch with tags
    const bookmarkWithTags = await fetchBookmarkWithTags(record.id, userId);
    if (!bookmarkWithTags) {
        throw new Error('Failed to fetch created bookmark');
    }
    return jsonResponse(200, serializeBookmark(bookmarkWithTags));
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
    if (resourceId) {
        const bookmarkWithTags = await fetchBookmarkWithTags(resourceId, userId);
        if (!bookmarkWithTags) {
            return jsonResponse(404, { error: 'Bookmark not found' });
        }
        return jsonResponse(200, serializeBookmark(bookmarkWithTags));
    }

    // Fetch all bookmarks
    const { data: bookmarks, error } = await supabaseAdmin
        .from('bookmarks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);

    if (error || !bookmarks) {
        throw new Error(error?.message ?? 'Failed to load bookmarks');
    }

    // Fetch all tags for these bookmarks
    const bookmarkIds = bookmarks.map(b => b.id);
    const { data: tagAssociations } = await supabaseAdmin
        .from('bookmark_tags')
        .select('bookmark_id, tags(id, user_id, name, created_at)')
        .in('bookmark_id', bookmarkIds);

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

    return jsonResponse(
        200,
        bookmarksWithTags.map(serializeBookmark)
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
