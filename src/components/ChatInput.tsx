import { memo, type KeyboardEvent, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Bookmark, Tag, Loader2, Send, X } from 'lucide-react';

export interface ChatContextBookmark {
    id: string;
    title: string;
}

export interface ChatSuggestion {
    id: string;
    type: 'tag' | 'bookmark';
    label: string;
}

interface ChatInputProps {
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;
    onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
    loading?: boolean;
    disabled?: boolean;
    placeholder?: string;
    tags?: string[];
    onRemoveTag?: (tag: string) => void;
    bookmarks?: ChatContextBookmark[];
    onRemoveBookmark?: (bookmarkId: string) => void;
    showSuggestions?: boolean;
    suggestions?: ChatSuggestion[];
    selectedIndex?: number;
    onSuggestionSelect?: (suggestion: ChatSuggestion) => void;
    onSuggestionHover?: (index: number) => void;
    inputRef?: React.RefObject<HTMLTextAreaElement>;
    suggestionPlacement?: 'top' | 'bottom';
}

export const ChatInput = memo(function ChatInput({
    value,
    onChange,
    onSend,
    onKeyDown,
    loading = false,
    disabled = false,
    placeholder,
    tags = [],
    onRemoveTag,
    bookmarks = [],
    onRemoveBookmark,
    showSuggestions = false,
    suggestions = [],
    selectedIndex = -1,
    onSuggestionSelect,
    onSuggestionHover,
    inputRef,
    suggestionPlacement = 'top'
}: ChatInputProps) {
    const { t } = useTranslation();

    const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        onChange(e.target.value);
        // Auto-resize textarea
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
    };

    return (
        <div className="relative">
            {(tags.length > 0 || bookmarks.length > 0) && (
                <div className="flex flex-wrap gap-2 mb-2">
                    {bookmarks.map(bookmark => (
                        <span key={bookmark.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-bg-active text-text-primary rounded-full">
                            <Bookmark className="w-3 h-3" />
                            {bookmark.title.length > 30 ? `${bookmark.title.slice(0, 30)}...` : bookmark.title}
                            {onRemoveBookmark && (
                                <button
                                    type="button"
                                    onClick={() => onRemoveBookmark(bookmark.id)}
                                    className="text-text-secondary hover:text-text-primary transition-colors"
                                    aria-label={`Remove ${bookmark.title}`}
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </span>
                    ))}
                    {tags.map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full">
                            @{tag}
                            {onRemoveTag && (
                                <button
                                    type="button"
                                    onClick={() => onRemoveTag(tag)}
                                    className="text-primary/60 hover:text-primary transition-colors"
                                    aria-label={`Remove ${tag}`}
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </span>
                    ))}
                </div>
            )}

            {showSuggestions && (
                <div className={`absolute left-0 right-0 bg-bg-main border border-border rounded-lg shadow-md z-50 max-h-[250px] overflow-y-auto ${suggestionPlacement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}`}>
                    {suggestions.length > 0 ? (
                        suggestions.map((suggestion, index) => (
                            <button
                                type="button"
                                key={`${suggestion.type}-${suggestion.id}`}
                                onClick={() => onSuggestionSelect?.(suggestion)}
                                className={`w-full px-3 py-2.5 text-left text-sm transition-colors flex items-center gap-2 ${index === selectedIndex ? 'bg-primary/10 text-primary' : 'text-text-primary hover:bg-bg-subtle'}`}
                                onMouseEnter={() => onSuggestionHover?.(index)}
                            >
                                {suggestion.type === 'tag' ? (
                                    <Tag className="w-3.5 h-3.5 opacity-60" />
                                ) : (
                                    <Bookmark className="w-3.5 h-3.5 opacity-60" />
                                )}
                                <span className="truncate flex-1">{suggestion.label}</span>
                                {suggestion.type === 'tag' && <span className="text-[10px] opacity-40 uppercase font-bold tracking-wider">Tag</span>}
                                {suggestion.type === 'bookmark' && <span className="text-[10px] opacity-40 uppercase font-bold tracking-wider">Link</span>}
                            </button>
                        ))
                    ) : (
                        <div className="px-3 py-2 text-sm text-text-secondary">
                            {t('chat.noSuggestions', 'No matches found')}
                        </div>
                    )}
                </div>
            )}

            <div className="flex items-end gap-2 bg-bg-subtle border border-border rounded-xl p-2">
                <textarea
                    ref={inputRef}
                    value={value}
                    onChange={handleChange}
                    placeholder={placeholder || t('chat.placeholder')}
                    onKeyDown={onKeyDown}
                    className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-text-primary placeholder:text-text-secondary min-h-[40px] max-h-[200px] py-2 px-2"
                    rows={1}
                    disabled={disabled}
                />
                <button
                    type="button"
                    onClick={onSend}
                    disabled={loading || !value.trim() || disabled}
                    className="w-11 h-11 flex items-center justify-center rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                    {loading ? (
                        <Loader2 className="animate-spin w-5 h-5" />
                    ) : (
                        <Send className="w-5 h-5" />
                    )}
                </button>
            </div>
        </div>
    );
});
