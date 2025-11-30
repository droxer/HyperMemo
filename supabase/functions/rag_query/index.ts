import { handleCors } from '../_shared/cors.ts';
import { jsonResponse } from '../_shared/response.ts';
import { requireUserId, supabaseAdmin } from '../_shared/supabaseClient.ts';
import { readJson } from '../_shared/request.ts';
import { cosineSimilarity, embedText, generateContent } from '../_shared/ai.ts';
import { serializeBookmark, type BookmarkRow } from '../_shared/bookmarks.ts';

type RagPayload = {
  question?: string;
};

type RagMatch = {
  bookmark: ReturnType<typeof serializeBookmark>;
  score: number;
};

function buildSourcesText(matches: RagMatch[]): string {
  return matches
    .map((match, index) => `[S${index + 1}] ${match.bookmark.title} — ${match.bookmark.summary}`)
    .join('\n');
}

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
    if (question.length < 3) {
      return jsonResponse(400, { error: 'Question is too short' });
    }
    const queryEmbedding = await embedText(question);
    if (!queryEmbedding.length) {
      return jsonResponse(400, { error: 'Unable to embed the question' });
    }
    const { data, error } = await supabaseAdmin
      .from('bookmarks')
      .select('*')
      .eq('user_id', userId)
      .not('embedding', 'is', null)
      .limit(500);
    if (error || !data) {
      throw new Error(error?.message ?? 'Failed to load bookmarks');
    }
    const matches: RagMatch[] = data
      .map((row) => {
        const bookmark = serializeBookmark(row as BookmarkRow);
        const embedding = Array.isArray(bookmark.embedding) ? bookmark.embedding : [];
        return {
          bookmark,
          score: cosineSimilarity(queryEmbedding, embedding)
        };
      })
      .filter((match) => match.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    const prompt = [
      'You are HyperMemo. Answer the question using ONLY the provided sources.',
      'Cite sources explicitly using [S#].',
      `Question: ${question}`,
      'Sources:',
      buildSourcesText(matches)
    ].join('\n');
    const answer = matches.length ? await generateContent(prompt) : 'No matching bookmarks yet.';
    return jsonResponse(200, { answer, matches });
  } catch (error) {
    console.error('rag-query function failed', error);
    return jsonResponse(500, { error: error instanceof Error ? error.message : 'Unknown error' });
  }
});
