import { handleCors } from '../_shared/cors.ts';
import { jsonResponse } from '../_shared/response.ts';
import { requireUserId, supabaseAdmin } from '../_shared/supabaseClient.ts';
import { readJson, getPathParam } from '../_shared/request.ts';

type TagPayload = {
    name?: string;
};

type TagRow = {
    id: string;
    user_id: string;
    name: string;
    created_at: string;
    bookmark_tags?: Array<{ count: number }>;
};

type TagWithCount = {
    id: string;
    userId: string;
    name: string;
    createdAt: string;
    bookmarkCount: number;
};

async function listTags(userId: string): Promise<Response> {
    // Get all tags for the user with bookmark counts
    const { data: tags, error } = await supabaseAdmin
        .from('tags')
        .select(`
      id,
      user_id,
      name,
      created_at,
      bookmark_tags(count)
    `)
        .eq('user_id', userId)
        .order('name', { ascending: true });

    if (error) {
        throw new Error(error.message ?? 'Failed to load tags');
    }

    // Transform the data to include bookmark count
    const tagsWithCount = (tags || []).map((tag: TagRow) => ({
        id: tag.id,
        userId: tag.user_id,
        name: tag.name,
        createdAt: tag.created_at,
        bookmarkCount: tag.bookmark_tags?.[0]?.count ?? 0
    }));

    return jsonResponse(200, tagsWithCount);
}

async function getTag(userId: string, tagId: string): Promise<Response> {
    const { data: tag, error } = await supabaseAdmin
        .from('tags')
        .select(`
      id,
      user_id,
      name,
      created_at,
      bookmark_tags(count)
    `)
        .eq('id', tagId)
        .eq('user_id', userId)
        .single();

    if (error || !tag) {
        return jsonResponse(404, { error: 'Tag not found' });
    }

    return jsonResponse(200, {
        id: tag.id,
        userId: tag.user_id,
        name: tag.name,
        createdAt: tag.created_at,
        bookmarkCount: (tag as TagRow).bookmark_tags?.[0]?.count ?? 0
    });
}

async function createTag(userId: string, payload: TagPayload): Promise<Response> {
    const name = (payload.name ?? '').trim().toLowerCase();
    if (!name) {
        return jsonResponse(400, { error: 'Tag name is required' });
    }

    // Check if tag already exists
    const { data: existing } = await supabaseAdmin
        .from('tags')
        .select('id')
        .eq('user_id', userId)
        .eq('name', name)
        .single();

    if (existing) {
        return jsonResponse(409, { error: 'Tag already exists' });
    }

    const { data: tag, error } = await supabaseAdmin
        .from('tags')
        .insert({ user_id: userId, name })
        .select()
        .single();

    if (error || !tag) {
        throw new Error(error?.message ?? 'Failed to create tag');
    }

    return jsonResponse(201, {
        id: tag.id,
        userId: tag.user_id,
        name: tag.name,
        createdAt: tag.created_at,
        bookmarkCount: 0
    });
}

async function updateTag(userId: string, tagId: string, payload: TagPayload): Promise<Response> {
    const name = (payload.name ?? '').trim().toLowerCase();
    if (!name) {
        return jsonResponse(400, { error: 'Tag name is required' });
    }

    // Check if new name conflicts with existing tag
    const { data: existing } = await supabaseAdmin
        .from('tags')
        .select('id')
        .eq('user_id', userId)
        .eq('name', name)
        .neq('id', tagId)
        .single();

    if (existing) {
        return jsonResponse(409, { error: 'Tag name already exists' });
    }

    const { data: tag, error } = await supabaseAdmin
        .from('tags')
        .update({ name })
        .eq('id', tagId)
        .eq('user_id', userId)
        .select()
        .single();

    if (error || !tag) {
        return jsonResponse(404, { error: 'Tag not found' });
    }

    return jsonResponse(200, {
        id: tag.id,
        userId: tag.user_id,
        name: tag.name,
        createdAt: tag.created_at
    });
}

async function deleteTag(userId: string, tagId: string): Promise<Response> {
    // Delete will cascade to bookmark_tags due to foreign key
    const { error } = await supabaseAdmin
        .from('tags')
        .delete()
        .eq('id', tagId)
        .eq('user_id', userId);

    if (error) {
        throw new Error(error.message);
    }

    return jsonResponse(200, { success: true });
}

async function mergeTag(userId: string, sourceTagId: string, targetTagId: string): Promise<Response> {
    // Verify both tags exist and belong to user
    const { data: sourceTags } = await supabaseAdmin
        .from('tags')
        .select('id, name')
        .eq('user_id', userId)
        .in('id', [sourceTagId, targetTagId]);

    if (!sourceTags || sourceTags.length !== 2) {
        return jsonResponse(404, { error: 'One or both tags not found' });
    }

    // Get all bookmarks with source tag
    const { data: bookmarkTags } = await supabaseAdmin
        .from('bookmark_tags')
        .select('bookmark_id')
        .eq('tag_id', sourceTagId);

    if (bookmarkTags && bookmarkTags.length > 0) {
        // For each bookmark, add target tag if not already present
        for (const bt of bookmarkTags) {
            // Check if association already exists
            const { data: existing } = await supabaseAdmin
                .from('bookmark_tags')
                .select('bookmark_id')
                .eq('bookmark_id', bt.bookmark_id)
                .eq('tag_id', targetTagId)
                .single();

            if (!existing) {
                await supabaseAdmin
                    .from('bookmark_tags')
                    .insert({ bookmark_id: bt.bookmark_id, tag_id: targetTagId });
            }
        }
    }

    // Delete source tag (will cascade delete bookmark_tags)
    await supabaseAdmin
        .from('tags')
        .delete()
        .eq('id', sourceTagId)
        .eq('user_id', userId);

    return jsonResponse(200, { success: true, merged: bookmarkTags?.length ?? 0 });
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

    const url = new URL(req.url);
    const resourceId = getPathParam(req, '/tags');

    try {
        // Handle merge operation: POST /tags/:sourceId/merge/:targetId
        if (req.method === 'POST' && url.pathname.includes('/merge/')) {
            const parts = url.pathname.split('/');
            const mergeIndex = parts.indexOf('merge');
            if (mergeIndex > 0 && mergeIndex < parts.length - 1) {
                const sourceId = parts[mergeIndex - 1];
                const targetId = parts[mergeIndex + 1];
                return await mergeTag(userId, sourceId, targetId);
            }
        }

        if (req.method === 'GET') {
            if (resourceId) {
                return await getTag(userId, resourceId);
            }
            return await listTags(userId);
        }

        if (req.method === 'POST') {
            const body = (await readJson<TagPayload>(req)) ?? {};
            return await createTag(userId, body);
        }

        if (req.method === 'PUT' || req.method === 'PATCH') {
            if (!resourceId) {
                return jsonResponse(400, { error: 'Tag ID is required' });
            }
            const body = (await readJson<TagPayload>(req)) ?? {};
            return await updateTag(userId, resourceId, body);
        }

        if (req.method === 'DELETE') {
            if (!resourceId) {
                return jsonResponse(400, { error: 'Tag ID is required' });
            }
            return await deleteTag(userId, resourceId);
        }

        return jsonResponse(405, { error: 'Method not allowed' });
    } catch (error) {
        console.error('tags function failed', error);
        return jsonResponse(500, { error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
