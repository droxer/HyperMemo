import { handleCors } from '../_shared/cors.ts';
import { jsonResponse } from '../_shared/response.ts';
import { requireUserId } from '../_shared/supabaseClient.ts';
import { readJson } from '../_shared/request.ts';
import { generateContent, parseTags } from '../_shared/ai.ts';
import { summarizePrompt, tagsPrompt } from '../_shared/prompts.ts';

type SummaryPayload = {
    title?: string;
    content?: string;
    url?: string;
};

Deno.serve(async (req: Request): Promise<Response> => {
    const cors = handleCors(req);
    if (cors) {
        return cors;
    }
    if (req.method !== 'POST') {
        return jsonResponse(405, { error: 'Method not allowed' });
    }
    const url = new URL(req.url);
    const isTagsRoute = url.pathname.endsWith('/tags');
    try {
        await requireUserId(req);
    } catch (error) {
        return jsonResponse(401, { error: error instanceof Error ? error.message : String(error) });
    }
    try {
        const body = (await readJson<SummaryPayload>(req)) ?? {};
        if (isTagsRoute) {
            const prompt = tagsPrompt(body.title ?? '', body.content ?? '');
            const text = await generateContent(prompt);
            return jsonResponse(200, { tags: parseTags(text) });
        }
        const prompt = summarizePrompt(body.title ?? '', body.content ?? '', body.url ?? '');
        const summary = await generateContent(prompt);
        return jsonResponse(200, { summary });
    } catch (error) {
        console.error('summaries function failed', error);
        return jsonResponse(500, { error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
