import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/services/apiClient';
import { createTag, deleteTag, listTags, mergeTags, renameTag } from './tagService';
import type { TagPayload, TagSummary } from '@/types/tag';

vi.mock('@/services/apiClient', () => ({
    apiClient: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
    }
}));

describe('tagService', () => {
    const mockTag: TagSummary = { id: 'tag-1', name: 'research', bookmarkCount: 3 };
    const payload: TagPayload = { name: 'research' };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('listTags fetches all tags', async () => {
        vi.mocked(apiClient.get).mockResolvedValue([mockTag]);
        const result = await listTags();
        expect(apiClient.get).toHaveBeenCalledWith('/tags');
        expect(result).toEqual([mockTag]);
    });

    it('createTag posts payload', async () => {
        vi.mocked(apiClient.post).mockResolvedValue(mockTag);
        const result = await createTag(payload);
        expect(apiClient.post).toHaveBeenCalledWith('/tags', payload);
        expect(result).toEqual(mockTag);
    });

    it('renameTag updates the resource', async () => {
        const updated = { ...mockTag, name: 'focus' };
        vi.mocked(apiClient.put).mockResolvedValue(updated);
        const result = await renameTag('tag-1', { name: 'focus' });
        expect(apiClient.put).toHaveBeenCalledWith('/tags/tag-1', { name: 'focus' });
        expect(result).toEqual(updated);
    });

    it('deleteTag removes resource without response payload', async () => {
        vi.mocked(apiClient.delete).mockResolvedValue(undefined);
        await deleteTag('tag-1');
        expect(apiClient.delete).toHaveBeenCalledWith('/tags/tag-1');
    });

    it('mergeTags posts merge endpoint', async () => {
        const response = { success: true, merged: 5 };
        vi.mocked(apiClient.post).mockResolvedValue(response);
        const result = await mergeTags('tag-1', 'tag-2');
        expect(apiClient.post).toHaveBeenCalledWith('/tags/tag-1/merge/tag-2', {});
        expect(result).toEqual(response);
    });
});
