import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, RefreshCw, Sparkles } from 'lucide-react';
import type { ChatMessage as ChatMessageType, Citation } from '@/types/bookmark';
import type { RagMatch } from '@/services/ragService';

// Helper to transform text with citation patterns into React nodes
function transformTextWithCitations(text: string, citations?: RagMatch[]): React.ReactNode {
    if (!text.includes('[')) return text;

    const parts = text.split(/(\[\d+\])/g);
    if (parts.length === 1) return text;

    return parts.map((part, index) => {
        const match = part.match(/^\[(\d+)\]$/);
        if (match && citations) {
            const citationIndex = Number.parseInt(match[1], 10) - 1;
            const citation = citations[citationIndex];
            if (citation) {
                return (
                    <a
                        key={`cite-${index}-${citation.bookmark.id}`}
                        href={citation.bookmark.url}
                        target="_blank"
                        rel="noreferrer"
                        className="relative inline-flex items-center px-1 mx-0.5 text-xs font-medium text-primary bg-primary/10 rounded hover:bg-primary/20 transition-colors group"
                    >
                        [{match[1]}]
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-text-primary text-bg-main rounded whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">{citation.bookmark.title}</span>
                    </a>
                );
            }
        }
        return part || null;
    });
}

// Component to render message content with inline citations
const MessageContent = memo(function MessageContent({
    content,
    citations,
    isUserMessage = false
}: {
    content: string;
    citations?: RagMatch[];
    isUserMessage?: boolean;
}) {
    const components = useMemo(() => ({
        a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { node?: unknown }) => (
            <a
                href={href}
                {...props}
                target="_blank"
                rel="noreferrer"
                className={isUserMessage ? 'text-white underline decoration-white/50 hover:decoration-white' : undefined}
            >
                {children}
            </a>
        ),
        p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement> & { node?: unknown }) => {
            const processChildren = (child: React.ReactNode): React.ReactNode => {
                if (typeof child === 'string') {
                    return transformTextWithCitations(child, citations);
                }
                return child;
            };
            const processed = Array.isArray(children) ? children.map(processChildren) : processChildren(children);
            return <p {...props}>{processed}</p>;
        },
        li: ({ children, ...props }: React.LiHTMLAttributes<HTMLLIElement> & { node?: unknown }) => {
            const processChildren = (child: React.ReactNode): React.ReactNode => {
                if (typeof child === 'string') {
                    return transformTextWithCitations(child, citations);
                }
                return child;
            };
            const processed = Array.isArray(children) ? children.map(processChildren) : processChildren(children);
            return <li {...props}>{processed}</li>;
        },
        strong: ({ children, ...props }: React.HTMLAttributes<HTMLElement> & { node?: unknown }) => {
            const processChildren = (child: React.ReactNode): React.ReactNode => {
                if (typeof child === 'string') {
                    return transformTextWithCitations(child, citations);
                }
                return child;
            };
            const processed = Array.isArray(children) ? children.map(processChildren) : processChildren(children);
            return <strong {...props}>{processed}</strong>;
        },
        em: ({ children, ...props }: React.HTMLAttributes<HTMLElement> & { node?: unknown }) => {
            const processChildren = (child: React.ReactNode): React.ReactNode => {
                if (typeof child === 'string') {
                    return transformTextWithCitations(child, citations);
                }
                return child;
            };
            const processed = Array.isArray(children) ? children.map(processChildren) : processChildren(children);
            return <em {...props}>{processed}</em>;
        }
    }), [citations, isUserMessage]);

    return (
        <div className={`prose prose-chat max-w-none ${isUserMessage ? 'prose-chat-user' : ''}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                {content}
            </ReactMarkdown>
        </div>
    );
});

interface ChatMessageProps {
    message: ChatMessageType;
    index: number;
    userAvatarUrl?: string;
    userEmail?: string;
    isCopied: boolean;
    isRegenerating: boolean;
    isLoading: boolean;
    onCopy: (messageId: string, content: string) => void;
    onRegenerate: (index: number) => void;
}

export const ChatMessage = memo(function ChatMessage({
    message,
    index,
    userAvatarUrl,
    userEmail,
    isCopied,
    isRegenerating,
    isLoading,
    onCopy,
    onRegenerate,
}: ChatMessageProps) {
    const { t } = useTranslation();
    const isUser = message.role === 'user';

    // Convert Citation[] to RagMatch[] for MessageContent
    const ragMatches: RagMatch[] | undefined = message.citations?.map(c => ({
        bookmark: c.bookmark,
        score: c.score
    }));

    return (
        <div className={`flex gap-2 md:gap-3 max-w-[95%] md:max-w-[90%] animate-fade-in mb-3 md:mb-4 ${isUser ? 'ml-auto flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${isUser ? 'bg-primary' : 'bg-bg-active'}`}>
                {isUser ? (
                    userAvatarUrl ? (
                        <img src={userAvatarUrl} alt="You" className="w-full h-full object-cover" />
                    ) : (
                        <div className="text-white text-sm font-medium">{userEmail?.charAt(0).toUpperCase() || 'U'}</div>
                    )
                ) : (
                    <div className="text-primary">
                        <Sparkles className="w-5 h-5" />
                    </div>
                )}
            </div>
            <div className="flex flex-col min-w-0">
                <div className={`px-4 py-3 md:px-5 md:py-4 rounded-2xl ${isUser ? 'bg-primary text-white rounded-tr-sm text-[0.9375rem]' : 'bg-bg-subtle rounded-tl-sm'}`}>
                    {message.content ? (
                        <MessageContent content={message.content} citations={ragMatches} isUserMessage={isUser} />
                    ) : message.role === 'assistant' ? (
                        <div className="flex gap-1">
                            <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    ) : null}
                </div>
                {message.role === 'assistant' && (
                    <div className="flex gap-2 mt-2 opacity-0 hover:opacity-100 transition-opacity">
                        <button
                            type="button"
                            className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-subtle rounded transition-colors"
                            onClick={() => onCopy(message.id, message.content)}
                            title={t('chat.copyResponse', 'Copy response')}
                        >
                            {isCopied ? (
                                <>
                                    <Check className="w-3.5 h-3.5" />
                                    <span>{t('chat.copied', 'Copied!')}</span>
                                </>
                            ) : (
                                <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>{t('chat.copy', 'Copy')}</span>
                                </>
                            )}
                        </button>
                        <button
                            type="button"
                            className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-subtle rounded transition-colors disabled:opacity-50"
                            onClick={() => onRegenerate(index)}
                            disabled={isRegenerating}
                            title={t('chat.regenerateResponse', 'Regenerate response')}
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
                            <span>{isRegenerating ? t('chat.regenerating', 'Regenerating...') : t('chat.regenerate', 'Regenerate')}</span>
                        </button>
                    </div>
                )}
                {/* Only show citations after streaming is complete */}
                {message.citations && message.citations.length > 0 && !isLoading && (
                    <div className="mt-3 pt-3 border-t border-border">
                        <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">{t('chat.sources')}</span>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {message.citations.map((citation) => (
                                <a
                                    key={citation.bookmark.id}
                                    href={citation.bookmark.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center px-2.5 py-1 text-xs bg-bg-active hover:bg-primary/10 text-text-primary hover:text-primary rounded-full transition-colors truncate max-w-[200px]"
                                    title={citation.bookmark.title}
                                >
                                    <span className="truncate">{citation.bookmark.title || t('dashboard.untitled')}</span>
                                </a>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});
