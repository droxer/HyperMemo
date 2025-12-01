import { apiClient } from '@/services/apiClient';
import type { TagPayload, TagSummary } from '@/types/tag';

export async function listTags(): Promise<TagSummary[]> {
    return apiClient.get<TagSummary[]>('/tags');
}

export async function createTag(payload: TagPayload): Promise<TagSummary> {
    return apiClient.post<TagSummary>('/tags', payload);
}

export async function renameTag(id: string, payload: TagPayload): Promise<TagSummary> {
    return apiClient.put<TagSummary>(`/tags/${id}`, payload);
}

export async function deleteTag(id: string): Promise<void> {
    await apiClient.delete(`/tags/${id}`);
}

export async function mergeTags(sourceId: string, targetId: string): Promise<{ success: boolean; merged: number }> {
    return apiClient.post<{ success: boolean; merged: number }>(`/tags/${sourceId}/merge/${targetId}`, {});
}
