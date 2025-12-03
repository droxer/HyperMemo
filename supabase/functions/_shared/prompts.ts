export function summarizePrompt(title: string, content: string, url: string): string {
    const parts = [
        'You are HyperMemo, a concise research assistant.',
        'Summarize the following content in a single paragraph.',
        'Focus ONLY on the provided content. Do not include external information or meta-commentary.',
        'If the content is empty or insufficient, describe the topic based on the title.'
    ];
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

export function ragPrompt(question: string, sources: string): string {
    return [
        'You are HyperMemo. Answer the question using ONLY the provided sources.',
        'When citing sources, use markdown links with the source title as the link text and the URL as the destination.',
        'Format citations as: [Source Title](URL)',
        'Do NOT use [S#] format. Instead, embed the actual source title as a clickable link.',
        `Question: ${question}`,
        'Sources:',
        sources
    ].join('\n');
}

export function rerankPrompt(question: string, items: string): string {
    return [
        'You are a relevance filter. Given a user question and a list of bookmarks, identify which bookmarks are RELEVANT to the question.',
        'Return ONLY a JSON array of the relevant IDs, sorted by relevance (most relevant first).',
        'Example output: ["id1", "id3"]',
        'If none are relevant, return [].',
        `Question: ${question}`,
        'Bookmarks:',
        items
    ].join('\n');
}
