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

export function ragPrompt(question: string, sources: string): string {
    return [
        'You are HyperMemo. Answer the question using ONLY the provided sources.',
        'Cite sources explicitly using [S#].',
        `Question: ${question}`,
        'Sources:',
        sources
    ].join('\n');
}
