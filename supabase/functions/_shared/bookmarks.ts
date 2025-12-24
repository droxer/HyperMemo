export type BookmarkRow = {
    id: string;
    user_id: string;
    title: string;
    url: string;
    summary: string | null;
    raw_content: string | null;
    /** Embedding vector - null until processed, number[] from JS, string from pgvector */
    embedding: number[] | null;
    created_at: string;
    updated_at: string;
};

export type Tag = {
    id: string;
    user_id: string;
    name: string;
    created_at: string;
};

export type BookmarkWithTags = BookmarkRow & {
    tags?: Tag[];
};

export type BookmarkPayload = {
    id?: string;
    title?: string;
    url?: string;
    tags?: string[] | null;
    summary?: string;
    rawContent?: string;
};

export function normalizeTags(tags: unknown): string[] {
    if (Array.isArray(tags)) {
        return tags
            .map((tag) => (typeof tag === 'string' ? tag.trim().toLowerCase() : ''))
            .filter(Boolean)
            .slice(0, 5);
    }
    return [];
}

export function serializeBookmark(row: BookmarkWithTags) {
    return {
        id: row.id,
        userId: row.user_id,
        title: row.title,
        url: row.url,
        tags: row.tags?.map(t => t.name) ?? [],
        summary: row.summary ?? '',
        rawContent: row.raw_content ?? '',
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}
