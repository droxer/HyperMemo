import { handleCors } from '../_shared/cors.ts';
import { jsonResponse } from '../_shared/response.ts';
import { readJson } from '../_shared/request.ts';
import { generateContent } from '../_shared/ai.ts';
import { chatToNotePrompt } from '../_shared/prompts.ts';

type ChatMessage = {
    role: 'user' | 'assistant';
    content: string;
    citations?: Array<{
        bookmark: {
            id: string;
            title: string;
            url: string;
        };
    }>;
};

type GenerateNotePayload = {
    title: string;
    messages: ChatMessage[];
};

type ExportPayload = {
    note?: Record<string, unknown>;
};

/**
 * Format chat messages into a readable string
 */
function formatChatHistory(messages: ChatMessage[]): string {
    return messages
        .map(msg => {
            const role = msg.role === 'user' ? 'User' : 'Assistant';
            return `${role}: ${msg.content}`;
        })
        .join('\n\n');
}

/**
 * Extract unique sources from chat messages
 */
function extractSources(messages: ChatMessage[]): string {
    const sources = new Map<string, { title: string; url: string }>();

    for (const msg of messages) {
        if (msg.citations) {
            for (const citation of msg.citations) {
                if (!sources.has(citation.bookmark.id)) {
                    sources.set(citation.bookmark.id, {
                        title: citation.bookmark.title,
                        url: citation.bookmark.url
                    });
                }
            }
        }
    }

    if (sources.size === 0) return '';

    return Array.from(sources.values())
        .map(s => `- [${s.title}](${s.url})`)
        .join('\n');
}

/**
 * Extract title from generated note content
 */
function extractTitle(content: string): string {
    const titleMatch = content.match(/^#\s+(.+)$/m);
    return titleMatch ? titleMatch[1].trim() : 'Untitled Note';
}

/**
 * Generate a summary from the note content
 */
function extractSummary(content: string): string {
    // Try to get content after "## Key Points" heading
    const keyPointsMatch = content.match(/##\s*Key Points\s*\n([\s\S]*?)(?=\n##|$)/i);
    if (keyPointsMatch) {
        const summary = keyPointsMatch[1].trim().slice(0, 200);
        return summary.length === 200 ? `${summary}...` : summary;
    }

    // Fallback: get first paragraph after the title
    const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    if (lines.length > 0) {
        const summary = lines[0].replace(/^[-*]\s*/, '').slice(0, 200);
        return summary.length === 200 ? `${summary}...` : summary;
    }

    return '';
}

Deno.serve(async (req: Request): Promise<Response> => {
    const cors = handleCors(req);
    if (cors) {
        return cors;
    }

    const url = new URL(req.url);
    const isExportRoute = url.pathname.endsWith('/export');
    const isGenerateRoute = url.pathname.endsWith('/generate');

    if (req.method !== 'POST') {
        return jsonResponse(405, { error: 'Method not allowed' });
    }

    // Handle /notes/generate - Transform chat to note using LLM
    if (isGenerateRoute) {
        try {
            const body = await readJson<GenerateNotePayload>(req);

            if (!body?.messages || body.messages.length === 0) {
                return jsonResponse(400, { error: 'Messages are required' });
            }

            const chatHistory = formatChatHistory(body.messages);
            const sources = extractSources(body.messages);
            const prompt = chatToNotePrompt(chatHistory, sources);

            const noteContent = await generateContent(prompt);
            const title = extractTitle(noteContent);
            const summary = extractSummary(noteContent);

            return jsonResponse(200, {
                title,
                body: noteContent,
                summary
            });
        } catch (error) {
            console.error('Note generation failed:', error);
            return jsonResponse(500, { error: error instanceof Error ? error.message : 'Failed to generate note' });
        }
    }

    // Handle /notes/export - Export to Google Docs (not implemented)
    if (isExportRoute) {
        const body = (await readJson<ExportPayload>(req)) ?? {};
        return jsonResponse(501, {
            error: 'Notes export via Supabase Edge Functions is not implemented yet.',
            note: body.note ?? null
        });
    }

    return jsonResponse(404, { error: 'Not found' });
});
