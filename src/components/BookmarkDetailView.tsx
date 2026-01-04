import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    ExternalLink,
    Loader2,
    RefreshCw,
    Trash2,
} from 'lucide-react';
import { BrainIcon } from '@/components/icons/BrainIcon';
import { TagInput } from '@/components/TagInput';
import { Button } from '@/components/ui/button';
import type { Bookmark } from '@/types/bookmark';
import { cleanMarkdownContent, isValidContent } from '@/utils/markdown';

interface BookmarkDetailViewProps {
    bookmark: Bookmark;
    detailedBookmark: Bookmark | null;
    loadingContent: boolean;
    isRegeneratingTags: boolean;
    isRegeneratingSummary: boolean;
    isRefetchingContent: boolean;
    onAskAI: (bookmark: Bookmark) => void;
    onDelete: () => void;
    onUpdateTags: (tags: string[]) => void;
    onRegenerateTags: () => void;
    onRegenerateSummary: () => void;
    onRefetchContent: () => void;
}

export const BookmarkDetailView = memo(function BookmarkDetailView({
    bookmark,
    detailedBookmark,
    loadingContent,
    isRegeneratingTags,
    isRegeneratingSummary,
    isRefetchingContent,
    onAskAI,
    onDelete,
    onUpdateTags,
    onRegenerateTags,
    onRegenerateSummary,
    onRefetchContent,
}: BookmarkDetailViewProps) {
    const { t } = useTranslation();

    return (
        <div className="max-w-[1000px] mx-auto">
            <header className="mb-6 md:mb-8 border-b border-border pb-4 md:pb-6">
                <div className="flex justify-between items-start gap-3 md:gap-4">
                    <h1 className="text-xl md:text-3xl font-bold leading-tight tracking-tight">{bookmark.title}</h1>
                    <div className="flex gap-2 shrink-0">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-primary bg-primary/10 hover:bg-primary/20"
                            onClick={() => onAskAI(bookmark)}
                            title={t('dashboard.askAI')}
                        >
                            <BrainIcon size={20} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-error hover:bg-error/10"
                            onClick={onDelete}
                            title={t('dashboard.deleteBookmark')}
                        >
                            <Trash2 className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-2 md:gap-4 mt-3 md:mt-4 text-xs md:text-sm text-text-secondary flex-wrap">
                    <a href={bookmark.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 md:gap-2 text-primary hover:underline">
                        <ExternalLink className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        <span className="truncate max-w-[200px] md:max-w-none">{new URL(bookmark.url).hostname}</span>
                    </a>
                    <span>•</span>
                    <span>{new Date(bookmark.createdAt).toLocaleDateString()}</span>
                </div>
            </header>

            {/* Tags Section */}
            <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6 flex-wrap">
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs uppercase tracking-wider font-semibold text-text-secondary">{t('popup.fieldTags')}</span>
                    <button
                        type="button"
                        className="p-1 rounded text-text-secondary hover:text-primary hover:bg-bg-subtle transition-colors disabled:opacity-50"
                        onClick={onRegenerateTags}
                        disabled={isRegeneratingTags}
                        title={t('dashboard.autoTag')}
                    >
                        <RefreshCw className={`w-3 h-3 ${isRegeneratingTags ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                <TagInput
                    value={bookmark.tags || []}
                    onChange={onUpdateTags}
                    placeholder={t('dashboard.addTags')}
                />
            </div>

            {/* AI Summary Section */}
            <section className="bg-bg-subtle border border-border rounded-xl p-4 md:p-6 mb-4 md:mb-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold">{t('dashboard.summary')}</h2>
                    <button
                        type="button"
                        className="p-2 rounded-lg text-text-secondary hover:text-primary hover:bg-bg-main transition-colors disabled:opacity-50"
                        onClick={onRegenerateSummary}
                        disabled={isRegeneratingSummary}
                        title={t('dashboard.regenerate')}
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRegeneratingSummary ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                <div className="prose max-w-none text-text-primary">
                    {isRegeneratingSummary ? (
                        <div className="flex gap-1">
                            <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    ) : (
                        <ReactMarkdown>
                            {detailedBookmark?.summary || bookmark.summary || t('dashboard.noContent')}
                        </ReactMarkdown>
                    )}
                </div>
            </section>

            {/* Content Section */}
            <section className="bg-bg-subtle border border-border rounded-xl p-4 md:p-6 mb-4 md:mb-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold">{t('dashboard.originalContent')}</h2>
                    <button
                        type="button"
                        className="p-2 rounded-lg text-text-secondary hover:text-primary hover:bg-bg-subtle transition-colors disabled:opacity-50"
                        onClick={onRefetchContent}
                        disabled={isRefetchingContent}
                        title={t('dashboard.refetchContent')}
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefetchingContent ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                {loadingContent || isRefetchingContent ? (
                    <div className="flex justify-center items-center py-8 text-text-secondary">
                        <Loader2 className="animate-spin w-6 h-6" />
                    </div>
                ) : isValidContent(detailedBookmark?.rawContent) ? (
                    <div className="prose max-w-none text-text-primary">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                a: ({ node, ...props }) => <a target="_blank" rel="noopener noreferrer" {...props} />
                            }}
                        >
                            {cleanMarkdownContent(detailedBookmark?.rawContent || '', bookmark.url)}
                        </ReactMarkdown>
                    </div>
                ) : bookmark.url ? (
                    <div className="flex flex-col items-center gap-4 py-8 text-center">
                        <p className="text-text-secondary">
                            {t('dashboard.contentNotAvailable')}
                        </p>
                        <a
                            href={bookmark.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
                        >
                            <ExternalLink className="w-4 h-4" />
                            {t('dashboard.viewOriginalPage')}
                        </a>
                    </div>
                ) : (
                    <div className="text-text-secondary italic text-center py-8">
                        {t('dashboard.selectBookmarkToView')}
                    </div>
                )}
            </section>
        </div>
    );
});
