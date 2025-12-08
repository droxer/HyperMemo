import type { Bookmark, NoteDocument, ChatSession, ChatMessage } from '@/types/bookmark';
import { apiClient } from '@/services/apiClient';
import { chromeStorage } from '@/utils/chrome';

export const NOTES_CACHE_KEY = 'hypermemo:cache:notes';

function now(): string {
    return new Date().toISOString();
}

/**
 * Extract bookmark IDs from chat session citations
 */
function extractBookmarkIds(session: ChatSession): string[] {
    const ids = new Set<string>();
    for (const message of session.messages) {
        if (message.citations) {
            for (const citation of message.citations) {
                ids.add(citation.bookmark.id);
            }
        }
    }
    return Array.from(ids);
}

type GenerateNoteResponse = {
    title: string;
    body: string;
    summary: string;
};

/**
 * Generate a note from chat session using LLM
 */
export async function generateNoteFromChat(session: ChatSession): Promise<NoteDocument> {
    // Call the backend to generate a proper note using LLM
    const response = await apiClient.post<GenerateNoteResponse>('/notes/generate', {
        title: session.title,
        messages: session.messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            citations: msg.citations?.map(c => ({
                bookmark: {
                    id: c.bookmark.id,
                    title: c.bookmark.title,
                    url: c.bookmark.url
                }
            }))
        }))
    });

    return {
        id: crypto.randomUUID(),
        title: response.title,
        body: response.body,
        summary: response.summary,
        sourceType: 'chat',
        chatSessionId: session.id,
        bookmarkIds: extractBookmarkIds(session),
        createdAt: now(),
        updatedAt: now()
    };
}

/**
 * Create a note from selected bookmarks
 */
export async function composeNoteFromBookmarks(
    title: string,
    bookmarks: Bookmark[]
): Promise<NoteDocument> {
    const sections = bookmarks
        .map(
            (bookmark) => `### ${bookmark.title}\n- URL: ${bookmark.url}\n- Tags: ${bookmark.tags.join(', ') || 'untagged'
                }\n- Summary: ${bookmark.summary}\n`
        )
        .join('\n');

    return {
        id: crypto.randomUUID(),
        title,
        bookmarkIds: bookmarks.map((bookmark) => bookmark.id),
        body: `# ${title}\n\n${sections}`,
        sourceType: 'bookmarks',
        createdAt: now(),
        updatedAt: now()
    };
}

/**
 * Save a note to local storage
 */
export async function saveNote(note: NoteDocument): Promise<NoteDocument> {
    const notes = await listNotes();
    const existingIndex = notes.findIndex(n => n.id === note.id);

    const updatedNote = { ...note, updatedAt: now() };

    if (existingIndex >= 0) {
        notes[existingIndex] = updatedNote;
    } else {
        notes.unshift(updatedNote);
    }

    await chromeStorage.set(NOTES_CACHE_KEY, notes);
    return updatedNote;
}

/**
 * Get all notes from local storage
 */
export async function listNotes(): Promise<NoteDocument[]> {
    return chromeStorage.get<NoteDocument[]>(NOTES_CACHE_KEY, []);
}

/**
 * Get a single note by ID
 */
export async function getNote(id: string): Promise<NoteDocument | null> {
    const notes = await listNotes();
    return notes.find(n => n.id === id) || null;
}

/**
 * Delete a note
 */
export async function deleteNote(id: string): Promise<void> {
    const notes = await listNotes();
    const filtered = notes.filter(n => n.id !== id);
    await chromeStorage.set(NOTES_CACHE_KEY, filtered);
}

/**
 * Export note to Google Docs (placeholder for future implementation)
 */
export async function exportNoteToGoogleDocs(note: NoteDocument): Promise<NoteDocument> {
    return apiClient.post<NoteDocument>('/notes/export', { note });
}
