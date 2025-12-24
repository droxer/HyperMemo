import { supabaseAdmin } from './supabaseClient.ts';

export type TagRelation<T> = T[] | T | null | undefined;

export function normalizeTagResult<T>(value: TagRelation<T>): T[] {
    if (Array.isArray(value)) {
        return value;
    }
    if (value) {
        return [value];
    }
    return [];
}

/**
 * Get or create a tag for a user.
 * Returns the tag ID.
 */
export async function getOrCreateTag(userId: string, tagName: string): Promise<string> {
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
    tags?: Array<{ name: string }> | { name: string } | null;
};

/**
 * Sync bookmark tags - adds new tags and optionally removes old ones.
 * @param bookmarkId The bookmark to sync tags for
 * @param userId The user who owns the bookmark
 * @param tagNames The new set of tag names
 * @param removeOld If true, removes tags not in the new set (default: true)
 */
export async function syncBookmarkTags(
    bookmarkId: string,
    userId: string,
    tagNames: string[],
    removeOld = true
): Promise<void> {
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

    // Find tags to add
    const tagsToAdd = tagNames.filter(name => !currentTagNames.has(name));

    // Find tags to remove (only if removeOld is true)
    const tagsToRemove = removeOld
        ? (currentAssociations || [])
            .filter((assoc: BookmarkTagAssociation) => {
                const assocTags = normalizeTagResult(assoc.tags);
                return assocTags[0] && !newTagNames.has(assocTags[0].name);
            })
            .map((assoc: BookmarkTagAssociation) => assoc.tag_id)
        : [];

    // Remove old associations
    if (tagsToRemove.length > 0) {
        await supabaseAdmin
            .from('bookmark_tags')
            .delete()
            .eq('bookmark_id', bookmarkId)
            .in('tag_id', tagsToRemove);
    }

    // Add new associations (batch insert for efficiency)
    if (tagsToAdd.length > 0) {
        const tagIds = await Promise.all(
            tagsToAdd.map(tagName => getOrCreateTag(userId, tagName))
        );
        await supabaseAdmin
            .from('bookmark_tags')
            .insert(tagIds.map(tag_id => ({ bookmark_id: bookmarkId, tag_id })));
    }
}
