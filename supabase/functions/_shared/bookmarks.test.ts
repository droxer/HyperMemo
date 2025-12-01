import { assert, assertEquals } from './testUtils.ts';
import { normalizeTags, serializeBookmark, type BookmarkWithTags, type Tag } from './bookmarks.ts';

Deno.test('normalizeTags trims, lowercases, filters, and limits to five tags', () => {
    const input = ['  Foo ', 'Bar', 'FOO', 123, '', 'baz', 'qux', 'quux'];
    const normalized = normalizeTags(input);

    assertEquals(normalized.length, 5);
    assertEquals(normalized, ['foo', 'bar', 'foo', 'baz', 'qux']);
});

Deno.test('normalizeTags returns empty array for non-array input', () => {
    const normalized = normalizeTags('foo');
    assertEquals(normalized, []);
});

Deno.test('serializeBookmark maps tags and omits embedding data', () => {
    const tags: Tag[] = [
        { id: '1', user_id: 'user', name: 'foo', created_at: '2024-01-01T00:00:00Z' },
        { id: '2', user_id: 'user', name: 'bar', created_at: '2024-01-02T00:00:00Z' }
    ];

    const row: BookmarkWithTags = {
        id: 'bookmark-1',
        user_id: 'user',
        title: 'Title',
        url: 'https://example.com',
        summary: null,
        raw_content: null,
        embedding: [0.1, 0.2],
        created_at: '2024-02-01T00:00:00Z',
        updated_at: '2024-02-02T00:00:00Z',
        tags
    };

    const serialized = serializeBookmark(row);
    assertEquals(serialized.tags, ['foo', 'bar']);
    assertEquals(serialized.summary, '');
    assertEquals(serialized.rawContent, '');
    assertEquals(serialized.id, row.id);
    assertEquals(serialized.userId, row.user_id);
    assertEquals(serialized.createdAt, row.created_at);
    assertEquals(serialized.updatedAt, row.updated_at);
    assert(!('embedding' in serialized));
});
