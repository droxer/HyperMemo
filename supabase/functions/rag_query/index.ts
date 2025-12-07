import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { jsonResponse } from '../_shared/response.ts';
import { requireUserId, supabaseAdmin } from '../_shared/supabaseClient.ts';
import { readJson } from '../_shared/request.ts';
import { embedText, streamContent, generateContent } from '../_shared/ai.ts';
import { ragPrompt, rerankPrompt } from '../_shared/prompts.ts';

type ConversationMessage = {
    role: 'user' | 'assistant';
    content: string;
};

type RagPayload = {
    question?: string;
    tags?: string[];
    conversation_history?: ConversationMessage[];
    stream?: boolean;
};

type RpcMatch = {
    id: string;
    user_id: string;
    title: string;
    url: string;
    summary: string;
    raw_content: string;
    tags: string[];
    created_at: string;
    updated_at: string;
    similarity: number;
};

type RagMatch = {
    bookmark: {
        id: string;
        title: string;
        url: string;
        summary: string;
        tags: string[];
    };
    score: number;
};

/**
 * Build formatted sources text from matches for the RAG prompt
 */
function buildSourcesText(matches: RagMatch[]): string {
    return matches
        .map((match, index) => {
            return `[S${index + 1}] Title: ${match.bookmark.title}\nURL: ${match.bookmark.url}\nSummary: ${match.bookmark.summary}\n`;
        })
        .join('\n');
}

/**
 * Resolve tag names to IDs
 */
async function resolveTagIds(userId: string, tagNames: string[]): Promise<string[]> {
    if (tagNames.length === 0) {
        return [];
    }

    const { data, error } = await supabaseAdmin
        .from('tags')
        .select('id')
        .eq('user_id', userId)
        .in('name', tagNames);

    if (error) {
        throw new Error(error.message);
    }

    return data?.map(t => t.id) || [];
}

/**
 * Search bookmarks using pgvector RPC
 */
async function searchBookmarks(
    userId: string,
    queryEmbedding: number[],
    tagIds: string[]
): Promise<RpcMatch[]> {
    const { data, error } = await supabaseAdmin.rpc('match_bookmarks', {
        query_embedding: queryEmbedding,
        match_threshold: 0.1, // Low threshold to get enough candidates for re-ranking
        match_count: 50,      // Fetch top 50 to allow for re-ranking
        filter_user_id: userId,
        filter_tag_ids: tagIds.length > 0 ? tagIds : null
    });

    if (error) {
        throw new Error(error.message);
    }

    return (data || []) as RpcMatch[];
}

/**
 * Rerank bookmarks using LLM
 */
async function rerankBookmarksWithLLM(
    question: string,
    matches: RpcMatch[]
): Promise<RagMatch[]> {
    if (matches.length === 0) return [];

    // Format items for the LLM
    const itemsText = matches
        .map(m => `ID: ${m.id}\nTitle: ${m.title}\nSummary: ${m.summary}\n---`)
        .join('\n');

    const prompt = rerankPrompt(question, itemsText);
    const response = await generateContent(prompt);

    // Parse JSON output
    let relevantIds: string[] = [];
    try {
        // Try to find JSON array in the response
        const jsonMatch = response.match(/\[.*\]/s);
        if (jsonMatch) {
            relevantIds = JSON.parse(jsonMatch[0]);
        } else {
            // Fallback: try parsing the whole text
            relevantIds = JSON.parse(response);
        }
    } catch (e) {
        console.error('Failed to parse rerank response:', response, e);
        // Fallback: return top 5 original matches if parsing fails
        return matches.slice(0, 5).map(m => ({
            bookmark: {
                id: m.id,
                title: m.title,
                url: m.url,
                summary: m.summary,
                tags: m.tags
            },
            score: m.similarity
        }));
    }

    if (!Array.isArray(relevantIds)) {
        return [];
    }

    // Filter and reorder matches based on relevantIds
    const relevantMatches: RagMatch[] = [];

    // Create a map for quick lookup
    const matchMap = new Map(matches.map(m => [m.id, m]));

    for (const id of relevantIds) {
        const match = matchMap.get(id);
        if (match) {
            relevantMatches.push({
                bookmark: {
                    id: match.id,
                    title: match.title,
                    url: match.url,
                    summary: match.summary,
                    tags: match.tags
                },
                score: 1.0 // High score for LLM-selected items
            });
        }
    }

    return relevantMatches;
}

/**
 * Main RAG query handler (non-streaming)
 */
async function handleRagQuery(
    userId: string,
    question: string,
    tags: string[],
    conversationHistory: ConversationMessage[]
): Promise<Response> {
    const queryEmbedding = await embedText(question);
    if (!queryEmbedding.length) {
        return jsonResponse(400, { error: 'Unable to embed the question' });
    }

    const tagIds = await resolveTagIds(userId, tags);

    if (tags.length > 0 && tagIds.length === 0) {
        return jsonResponse(200, {
            answer: 'No bookmarks found with the selected tags.',
            matches: []
        });
    }

    // Search bookmarks using RPC
    const searchResults = await searchBookmarks(userId, queryEmbedding, tagIds);

    if (searchResults.length === 0) {
        return jsonResponse(200, {
            answer: 'No matching bookmarks yet.',
            matches: []
        });
    }

    // Rerank bookmarks using LLM
    // We take top 20 from vector search to pass to LLM for reranking
    const candidates = searchResults.slice(0, 20);
    const matches = await rerankBookmarksWithLLM(question, candidates);

    // Generate answer using RAG with conversation history
    const prompt = ragPrompt(question, buildSourcesText(matches), conversationHistory);
    const answer = matches.length ? await generateContent(prompt) : 'No matching bookmarks yet.';

    return jsonResponse(200, { answer, matches });
}

/**
 * Main RAG query handler (streaming via SSE)
 */
async function handleRagQueryStream(
    userId: string,
    question: string,
    tags: string[],
    conversationHistory: ConversationMessage[]
): Promise<Response> {
    const queryEmbedding = await embedText(question);
    if (!queryEmbedding.length) {
        return jsonResponse(400, { error: 'Unable to embed the question' });
    }

    const tagIds = await resolveTagIds(userId, tags);

    if (tags.length > 0 && tagIds.length === 0) {
        // Return SSE with no matches message
        const body = new ReadableStream({
            start(controller) {
                const encoder = new TextEncoder();
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'matches', matches: [] })}\n\n`));
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content: 'No bookmarks found with the selected tags.' })}\n\n`));
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
                controller.close();
            }
        });
        return new Response(body, {
            headers: {
                ...corsHeaders,
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        });
    }

    // Search bookmarks using RPC
    const searchResults = await searchBookmarks(userId, queryEmbedding, tagIds);

    if (searchResults.length === 0) {
        const body = new ReadableStream({
            start(controller) {
                const encoder = new TextEncoder();
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'matches', matches: [] })}\n\n`));
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content: 'No matching bookmarks yet.' })}\n\n`));
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
                controller.close();
            }
        });
        return new Response(body, {
            headers: {
                ...corsHeaders,
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        });
    }

    // Rerank bookmarks using LLM
    const candidates = searchResults.slice(0, 20);
    const matches = await rerankBookmarksWithLLM(question, candidates);

    // Generate answer using RAG with streaming
    const prompt = ragPrompt(question, buildSourcesText(matches), conversationHistory);

    const body = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();

            // First, send the matches
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'matches', matches })}\n\n`));

            if (!matches.length) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content: 'No matching bookmarks yet.' })}\n\n`));
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
                controller.close();
                return;
            }

            try {
                // Stream the content
                for await (const chunk of streamContent(prompt)) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`));
                }
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
            } catch (error) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: error instanceof Error ? error.message : 'Unknown error' })}\n\n`));
            } finally {
                controller.close();
            }
        }
    });

    return new Response(body, {
        headers: {
            ...corsHeaders,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        }
    });
}

/**
 * Deno serve entry point
 */
Deno.serve(async (req: Request): Promise<Response> => {
    const cors = handleCors(req);
    if (cors) {
        return cors;
    }

    if (req.method !== 'POST') {
        return jsonResponse(405, { error: 'Method not allowed' });
    }

    let userId: string;
    try {
        userId = await requireUserId(req);
    } catch (error) {
        return jsonResponse(401, { error: error instanceof Error ? error.message : String(error) });
    }

    try {
        const body = (await readJson<RagPayload>(req)) ?? {};
        const question = (body.question ?? '').trim();
        const tags = body.tags ?? [];
        const conversationHistory = body.conversation_history ?? [];
        const stream = body.stream ?? false;

        if (question.length < 3) {
            return jsonResponse(400, { error: 'Question is too short' });
        }

        if (stream) {
            return await handleRagQueryStream(userId, question, tags, conversationHistory);
        }
        return await handleRagQuery(userId, question, tags, conversationHistory);
    } catch (error) {
        console.error('rag-query function failed', error);
        return jsonResponse(500, { error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
