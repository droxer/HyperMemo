export type BookmarkTag = {
    id: string;
    label: string;
};

export type RagChunk = {
    id: string;
    bookmarkId: string;
    text: string;
    embedding: number[];
};

export interface BookmarkPayload {
    title: string;
    url: string;
    tags: string[];
    summary: string;
    rawContent?: string;
}

export interface Bookmark extends BookmarkPayload {
    id: string;
    userId?: string;
    createdAt: string;
    updatedAt: string;
    vectorId?: string;
    vectorScore?: number;
    ragChunks?: RagChunk[];
    backendMetadata?: Record<string, unknown>;
    exportStatus?: 'idle' | 'queued' | 'exported' | 'failed';
    exportUrl?: string;
}

export interface NoteDocument {
    id: string;
    title: string;
    bookmarkIds: string[];
    body: string;
    status: 'draft' | 'exporting' | 'exported' | 'failed';
    exportUrl?: string;
    driveFileId?: string;
    createdAt: string;
}

export interface Citation {
    bookmark: Bookmark;
    score: number;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt: string;
    citations?: Citation[];
}

export interface ChatSession {
    id: string;
    title: string;
    messages: ChatMessage[];
    createdAt: string;
    updatedAt: string;
}
