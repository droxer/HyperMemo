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

type ConversationMessage = {
    role: 'user' | 'assistant';
    content: string;
};

export function ragPrompt(
    question: string,
    sources: string,
    conversationHistory?: ConversationMessage[]
): string {
    const hasSources = sources && sources.trim().length > 0;

    const parts = hasSources ? [
        'You are HyperMemo. Answer the question using the provided sources as primary context.',
        'IMPORTANT: When citing sources, use numbered superscript citations in the format [1], [2], etc.',
        'Place citations inline immediately after the relevant claim or fact.',
        'The numbers correspond to the source order [S1], [S2], etc. in the provided sources.',
        'Example: "React uses a virtual DOM for efficient updates [1]. Vue also implements reactivity [2]."',
        'Do NOT include the full URL or source title inline - just use the number in brackets.',
        'You may cite multiple sources for one claim: [1][2]'
    ] : [
        'You are HyperMemo, a knowledgeable AI assistant.',
        'No relevant bookmarks were found for this question.',
        'Answer the question to the best of your ability using your general knowledge.',
        'Provide a helpful, accurate, and well-structured response.',
        'At the end, add: "Note: No matching bookmarks found. This answer is based on general knowledge."'
    ];

    // Add conversation history if present
    if (conversationHistory && conversationHistory.length > 0) {
        parts.push('');
        parts.push('Previous conversation:');
        for (const msg of conversationHistory) {
            const role = msg.role === 'user' ? 'User' : 'Assistant';
            parts.push(`${role}: ${msg.content}`);
        }
        parts.push('');
        parts.push('Continue the conversation by answering the following question. Use context from the previous conversation when relevant.');
    }

    parts.push(`Question: ${question}`);

    if (hasSources) {
        parts.push('Sources:');
        parts.push(sources);
    }

    return parts.join('\n');
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

