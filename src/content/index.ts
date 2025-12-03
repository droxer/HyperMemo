import type { RuntimeMessage } from '@/types/messages';
import TurndownService from 'turndown';

// Initialize Turndown service
const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '_',
});

// Extract main content from the page
function extractMainContent(): HTMLElement | null {
    // Try common article selectors first
    const selectors = [
        'article',
        '[role="main"]',
        'main',
        '.article-content',
        '.post-content',
        '.entry-content',
        '#content',
        '.content',
    ];

    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element?.textContent && element.textContent.trim().length > 100) {
            return element as HTMLElement;
        }
    }

    // Fallback to body if no main content found
    return document.body;
}

// Convert HTML to clean markdown
function htmlToMarkdown(element: HTMLElement): string {
    // Clone the element to avoid modifying the page
    const clone = element.cloneNode(true) as HTMLElement;

    // Remove unwanted elements
    const unwantedSelectors = [
        'script',
        'style',
        'nav',
        'header',
        'footer',
        'aside',
        '.ad',
        '.advertisement',
        '.social-share',
        '.comments',
        'iframe[src*="ads"]',
    ];

    for (const selector of unwantedSelectors) {
        const elements = clone.querySelectorAll(selector);
        for (const el of Array.from(elements)) {
            el.remove();
        }
    }

    // Convert to markdown
    let markdown = turndownService.turndown(clone);

    // Clean up excessive whitespace
    markdown = markdown
        .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
        .replace(/[ \t]+$/gm, '') // Remove trailing spaces
        .trim();

    return markdown;
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
    if (message.type === 'CAPTURE_CONTENT') {
        const mainContent = extractMainContent();
        const content = mainContent ? htmlToMarkdown(mainContent) : undefined;

        const payload = {
            title: document.title,
            url: window.location.href,
            description:
                document.querySelector('meta[name="description"]')?.getAttribute('content') ??
                undefined,
            content,
            language: document.documentElement.lang || navigator.language,
            favicon: (
                document.querySelector('link[rel="icon"]') as HTMLLinkElement | null
            )?.href
        };
        sendResponse({ type: 'CONTENT_CAPTURED', payload } satisfies RuntimeMessage);
        return true;
    }
    return false;
});
