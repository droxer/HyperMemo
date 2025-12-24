import type { Bookmark, BookmarkPayload } from '@/types/bookmark';
import { chromeStorage } from '@/utils/chrome';
import { apiClient } from '@/services/apiClient';

export const BOOKMARK_CACHE_KEY = 'hypermemo:cache:bookmarks';

async function refreshRemoteCache(): Promise<Bookmark[]> {
    const bookmarks = await apiClient.get<Bookmark[]>('/bookmarks');
    await chromeStorage.set(BOOKMARK_CACHE_KEY, bookmarks);
    return bookmarks;
}

export async function listBookmarks(): Promise<Bookmark[]> {
    try {
        return await refreshRemoteCache();
    } catch (error) {
        console.warn('Falling back to cached bookmarks', error);
        return chromeStorage.get<Bookmark[]>(BOOKMARK_CACHE_KEY, []);
    }
}

export async function getBookmark(id: string): Promise<Bookmark> {
    return await apiClient.get<Bookmark>(`/bookmarks/${id}`);
}

export async function saveBookmark(payload: BookmarkPayload & { id?: string }): Promise<Bookmark> {
    const endpoint = payload.id ? `/bookmarks/${payload.id}` : '/bookmarks';
    const method = payload.id ? apiClient.put<Bookmark> : apiClient.post<Bookmark>;
    const saved = await method(endpoint, payload);
    await refreshRemoteCache();
    return saved;
}

export async function removeBookmark(id: string): Promise<void> {
    // Optimistic update: remove from local cache immediately
    const bookmarks = await chromeStorage.get<Bookmark[]>(BOOKMARK_CACHE_KEY, []);
    const updated = bookmarks.filter(b => b.id !== id);
    await chromeStorage.set(BOOKMARK_CACHE_KEY, updated);

    await apiClient.delete(`/bookmarks/${id}`);
    // Refresh cache in background, don't block deletion
    refreshRemoteCache().catch(error => {
        console.warn('Failed to refresh cache after bookmark deletion:', error);
    });
}

export async function clearAllBookmarks(): Promise<void> {
    await apiClient.delete('/bookmarks');
    await refreshRemoteCache();
}
