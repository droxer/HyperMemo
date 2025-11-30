export type BookmarkRow = {
  id: string;
  user_id: string;
  title: string;
  url: string;
  tags: string[] | null;
  summary: string | null;
  note: string | null;
  raw_content: string | null;
  embedding: number[] | null;
  created_at: string;
  updated_at: string;
};

export type BookmarkPayload = {
  id?: string;
  title?: string;
  url?: string;
  tags?: string[] | null;
  summary?: string;
  note?: string;
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

export function serializeBookmark(row: BookmarkRow) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    url: row.url,
    tags: row.tags ?? [],
    summary: row.summary ?? '',
    note: row.note ?? '',
    rawContent: row.raw_content ?? '',
    embedding: row.embedding ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
