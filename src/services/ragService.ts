import type { Bookmark } from '@/types/bookmark';
import { apiClient } from '@/services/apiClient';

export type RagMatch = {
    bookmark: Bookmark;
    score: number;
};

export type RagResponse = {
    answer: string;
    matches: RagMatch[];
};

export type ConversationMessage = {
    role: 'user' | 'assistant';
    content: string;
};

export type StreamEvent =
    | { type: 'matches'; matches: RagMatch[] }
    | { type: 'content'; content: string }
    | { type: 'done' }
    | { type: 'error'; error: string };

export async function draftAnswerFromBookmarks(
    question: string,
    tags?: string[],
    bookmarkIds?: string[],
    conversationHistory?: ConversationMessage[]
): Promise<RagResponse> {
    return apiClient.post<RagResponse>('/rag_query', {
        question,
        tags,
        bookmark_ids: bookmarkIds,
        conversation_history: conversationHistory
    });
}

export async function* streamAnswerFromBookmarks(
    question: string,
    tags?: string[],
    bookmarkIds?: string[],
    conversationHistory?: ConversationMessage[]
): AsyncGenerator<StreamEvent, void, unknown> {
    const response = await apiClient.postStream('/rag_query', {
        question,
        tags,
        bookmark_ids: bookmarkIds,
        conversation_history: conversationHistory,
        stream: true
    });

    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;

                try {
                    const event = JSON.parse(trimmed.slice(6)) as StreamEvent;
                    yield event;
                } catch {
                    // Skip malformed JSON
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
}
