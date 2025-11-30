import {
  AI_PROVIDER,
  OPENAI_API_KEY,
  OPENAI_BASE_URL,
  OPENAI_EMBED_MODEL,
  OPENAI_MODEL
} from './env.ts';

const OPENAI_HEADERS = {
  Authorization: `Bearer ${OPENAI_API_KEY}`,
  'Content-Type': 'application/json'
};

async function callOpenAIChat(prompt: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: OPENAI_HEADERS,
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1
    })
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI chat failed: ${response.status} ${body}`);
  }
  const payload = await response.json();
  const choice = payload.choices?.[0]?.message?.content;
  return typeof choice === 'string' ? choice.trim() : '';
}

async function callOpenAIEmbedding(text: string): Promise<number[]> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  const response = await fetch(`${OPENAI_BASE_URL}/embeddings`, {
    method: 'POST',
    headers: OPENAI_HEADERS,
    body: JSON.stringify({
      model: OPENAI_EMBED_MODEL,
      input: [text]
    })
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI embeddings failed: ${response.status} ${body}`);
  }
  const payload = await response.json();
  const embedding = payload.data?.[0]?.embedding;
  return Array.isArray(embedding) ? embedding.map((value: number) => Number(value)) : [];
}

export async function generateContent(prompt: string): Promise<string> {
  if (AI_PROVIDER !== 'openai') {
    throw new Error(`Unsupported AI_PROVIDER: ${AI_PROVIDER}`);
  }
  return callOpenAIChat(prompt);
}

export async function embedText(text: string): Promise<number[]> {
  if (!text.trim()) {
    return [];
  }
  if (AI_PROVIDER !== 'openai') {
    throw new Error(`Unsupported AI_PROVIDER: ${AI_PROVIDER}`);
  }
  const normalized = text.replace(/\s+/g, ' ').trim();
  return callOpenAIEmbedding(normalized);
}

export function summarizePrompt(title: string, content: string, url: string): string {
  const parts = ['You are HyperMemo, a concise research assistant.'];
  if (title) {
    parts.push(`Title: ${title}`);
  }
  if (url) {
    parts.push(`URL: ${url}`);
  }
  parts.push('Content:');
  parts.push(content.slice(0, 8000));
  return parts.join('\n');
}

export function tagsPrompt(title: string, content: string): string {
  return [
    'Suggest up to 5 concise tags (single words) describing the following page. Return comma-separated words only.',
    `Title: ${title}`,
    'Content:',
    content.slice(0, 4000)
  ].join('\n');
}

export function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 5);
}

export async function ensureSummary(
  title: string,
  rawContent: string,
  url: string,
  summary: string
): Promise<string> {
  if (summary || !rawContent) {
    return summary;
  }
  return generateContent(summarizePrompt(title, rawContent, url));
}

export async function ensureTags(
  title: string,
  rawContent: string,
  tags: string[]
): Promise<string[]> {
  if (tags.length || !rawContent) {
    return tags;
  }
  const suggestion = await generateContent(tagsPrompt(title, rawContent));
  return parseTags(suggestion);
}

export async function computeEmbedding(parts: Array<string | undefined>): Promise<number[]> {
  const source = parts.filter((part) => typeof part === 'string' && part.trim()).join('\n');
  if (!source) {
    return [];
  }
  return embedText(source);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  if (!length) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (!normA || !normB) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
