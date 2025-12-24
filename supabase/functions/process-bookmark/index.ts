import { createClient } from "@supabase/supabase-js";
import { computeEmbedding, ensureSummary, ensureTags } from '../_shared/ai.ts';
import { syncBookmarkTags } from '../_shared/tagUtils.ts';
import { WEBHOOK_SECRET } from '../_shared/env.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { DOMParser } from "deno-dom";
import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";

const FETCH_TIMEOUT_MS = 15000; // 15 seconds timeout for fetching web content

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

type BookmarkRecord = {
    id: string;
    user_id: string;
    title: string;
    url: string;
    summary: string | null;
    raw_content: string | null;
    embedding: string | null; // pgvector returns string or array
};

type WebhookPayload = {
    type: 'INSERT';
    table: 'bookmarks';
    record: BookmarkRecord;
    schema: 'public';
    old_record: null;
};

async function fetchCurrentTags(bookmarkId: string): Promise<string[]> {
    const { data: currentAssociations } = await supabaseAdmin
        .from('bookmark_tags')
        .select('tags!inner(name)')
        .eq('bookmark_id', bookmarkId);

    type TagAssoc = { tags: { name: string } | { name: string }[] | null };
    return (currentAssociations || [])
        .map((assoc: TagAssoc) => {
            const tags = assoc.tags;
            if (Array.isArray(tags)) return tags[0]?.name;
            return tags?.name;
        })
        .filter((name): name is string => Boolean(name));
}

function cleanMarkdownContent(markdown: string, baseUrl: string): string {
    // Parse base URL for resolving relative links
    let origin = '';
    try {
        const urlObj = new URL(baseUrl);
        origin = urlObj.origin;
    } catch {
        // If URL parsing fails, just use empty origin
    }

    let cleaned = markdown;

    // Fix relative links: [text](/path) -> [text](https://domain.com/path)
    cleaned = cleaned.replace(/\]\(\/([^)]+)\)/g, `](${origin}/$1)`);

    // Remove orphaned link patterns like "](/path)" without preceding text
    cleaned = cleaned.replace(/\]\([^)]*\)(?!\])/g, '');

    // Remove empty links: [](url) or []()
    cleaned = cleaned.replace(/\[\]\([^)]*\)/g, '');

    // Remove broken image references
    cleaned = cleaned.replace(/!\[\]\([^)]*\)/g, '');

    // Clean up multiple consecutive newlines (more than 2)
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // Remove lines that are just numbers (like engagement counts: "60", "437", "2K")
    cleaned = cleaned.replace(/^[\d,.]+[KMB]?$/gm, '');

    // Remove lines that look like social media metrics (e.g., "774K775K")
    cleaned = cleaned.replace(/^[\d,.]+[KMB]?[\d,.]+[KMB]?$/gm, '');

    // Clean up resulting empty lines
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // Trim whitespace
    cleaned = cleaned.trim();

    return cleaned;
}

async function fetchAndCleanContent(url: string): Promise<string | null> {
    try {
        console.log(`Fetching content from ${url}...`);

        // Add timeout to prevent hanging on slow/unresponsive servers
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        let response: Response;
        try {
            response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; HyperMemoBot/1.0; +http://hypermemo.app)'
                },
                signal: controller.signal
            });
        } finally {
            clearTimeout(timeoutId);
        }

        if (!response.ok) {
            console.warn(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
            return null;
        }

        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, "text/html");

        if (!doc) {
            console.warn("Failed to parse HTML");
            return null;
        }

        const reader = new Readability(doc);
        const article = reader.parse();

        if (!article || !article.content) {
            console.warn("Readability failed to extract content");
            return null;
        }

        const turndownService = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced'
        });

        const rawMarkdown = turndownService.turndown(article.content);

        // Clean up the markdown content
        return cleanMarkdownContent(rawMarkdown, url);

    } catch (error) {
        console.error(`Error fetching/cleaning content for ${url}:`, error);
        return null;
    }
}

async function processBookmarkRecord(record: BookmarkRecord) {
    console.log(`Processing bookmark: ${record.id}`);

    const { id, user_id, title, url, raw_content, summary: initialSummary } = record;
    let rawContent = raw_content ?? '';
    const currentSummary = initialSummary ?? '';

    // 0. Fetch and clean content if URL is present
    if (url) {
        const cleanedContent = await fetchAndCleanContent(url);
        if (cleanedContent) {
            console.log("Successfully fetched and cleaned content from URL");
            rawContent = cleanedContent;
        } else {
            console.log("Falling back to provided raw_content");
        }
    }

    // 1. Fetch current tags (user might have added some)
    const currentTags = await fetchCurrentTags(id);

    // 2. Generate AI content
    console.log(`Generating summary and tags for ${id}...`);
    const generatedSummary = await ensureSummary(title, rawContent, url, currentSummary);
    const generatedTags = await ensureTags(title, rawContent, currentTags);

    // 3. Compute Embedding
    console.log(`Computing embedding for ${id}...`);
    const embedding = await computeEmbedding([title, generatedSummary, rawContent]);

    // 4. Update Bookmark Record
    const { error: updateError } = await supabaseAdmin
        .from('bookmarks')
        .update({
            summary: generatedSummary,
            raw_content: rawContent,
            embedding: embedding
        })
        .eq('id', id);

    if (updateError) {
        console.error('Failed to update bookmark:', updateError);
        throw updateError;
    }

    // 5. Sync Tags (Add new ones, don't remove existing user tags)
    if (generatedTags.length > 0) {
        await syncBookmarkTags(id, user_id, generatedTags, false);
    }

    console.log(`Successfully processed bookmark ${id}`);
}

Deno.serve(async (req: Request): Promise<Response> => {
    const corsHeaders = getCorsHeaders(req);

    // Handle CORS preflight request
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

    try {
        // 1. Check for Webhook (internal trigger from database)
        const webhookSecret = req.headers.get('x-webhook-secret');
        const expectedSecret = WEBHOOK_SECRET || 'hypermemo-webhook-secret'; // Fallback for backwards compatibility
        if (webhookSecret === expectedSecret) {
            const payload: WebhookPayload = await req.json();
            const { record } = payload;
            if (!record || !record.id) {
                return new Response(JSON.stringify({ error: "No record found" }), { status: 400, headers: jsonHeaders });
            }
            await processBookmarkRecord(record);
            return new Response(JSON.stringify({ success: true }), { headers: jsonHeaders });
        }

        // 2. Check for User Request (Authorization header)
        const authHeader = req.headers.get('Authorization');
        if (authHeader) {
            // Verify user
            const supabaseClient = createClient(
                supabaseUrl,
                Deno.env.get('SUPABASE_ANON_KEY') ?? '',
                { global: { headers: { Authorization: authHeader } } }
            );
            const { data: { user }, error } = await supabaseClient.auth.getUser();

            if (error || !user) {
                return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
            }

            const { bookmark_id } = await req.json();
            if (!bookmark_id) {
                return new Response(JSON.stringify({ error: "Missing bookmark_id" }), { status: 400, headers: jsonHeaders });
            }

            // Fetch record
            const { data: record, error: fetchError } = await supabaseAdmin
                .from('bookmarks')
                .select('*')
                .eq('id', bookmark_id)
                .single();

            if (fetchError || !record) {
                return new Response(JSON.stringify({ error: "Bookmark not found" }), { status: 404, headers: jsonHeaders });
            }

            // Verify ownership
            if (record.user_id !== user.id) {
                return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: jsonHeaders });
            }

            await processBookmarkRecord(record);
            return new Response(JSON.stringify({ success: true }), { headers: jsonHeaders });
        }

        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });

    } catch (error) {
        console.error("Error processing bookmark:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        return new Response(JSON.stringify({ error: message }), { status: 500, headers: jsonHeaders });
    }
});
