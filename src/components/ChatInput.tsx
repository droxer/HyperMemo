import type { FC, KeyboardEvent, ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import './ChatInput.css';

export interface ChatContextBookmark {
    id: string;
    title: string;
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
    showTagSuggestions?: boolean;
    filteredTags?: string[];
    selectedTagIndex?: number;
    onTagSelect?: (tag: string) => void;
    onTagHover?: (index: number) => void;
    inputRef?: React.RefObject<HTMLTextAreaElement>;
    suggestionPlacement?: 'top' | 'bottom';
}

export const ChatInput: FC<ChatInputProps> = ({
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
    showTagSuggestions = false,
    filteredTags = [],
    selectedTagIndex = -1,
    onTagSelect,
    onTagHover,
    inputRef,
    suggestionPlacement = 'top'
}) => {
    const { t } = useTranslation();

    const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        onChange(e.target.value);
        // Auto-resize textarea
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
    };

    return (
        <div className="chat-input-container" style={{ position: 'relative' }}>
            {(tags.length > 0 || bookmarks.length > 0) && (
                <div className="chat-tags">
                    {bookmarks.map(bookmark => (
                        <span key={bookmark.id} className="chat-tag chat-tag-bookmark">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <title>Bookmark</title>
                                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                            </svg>
                            {bookmark.title.length > 30 ? `${bookmark.title.slice(0, 30)}...` : bookmark.title}
                            {onRemoveBookmark && (
                                <button
                                    type="button"
                                    onClick={() => onRemoveBookmark(bookmark.id)}
                                    className="chat-tag-remove"
                                    aria-label={`Remove ${bookmark.title}`}
                                >
                                    ×
                                </button>
                            )}
                        </span>
                    ))}
                    {tags.map(tag => (
                        <span key={tag} className="chat-tag">
                            @{tag}
                            {onRemoveTag && (
                                <button
                                    type="button"
                                    onClick={() => onRemoveTag(tag)}
                                    className="chat-tag-remove"
                                    aria-label={`Remove ${tag}`}
                                >
                                    ×
                                </button>
                            )}
                        </span>
                    ))}
                </div>
            )}

            {showTagSuggestions && (
                <div className={`tag-suggestions placement-${suggestionPlacement}`}>
                    {filteredTags.length > 0 ? (
                        filteredTags.map((tag, index) => (
                            <button
                                type="button"
                                key={tag}
                                onClick={() => onTagSelect?.(tag)}
                                className={`tag-suggestion ${index === selectedTagIndex ? 'active' : ''}`}
                                onMouseEnter={() => onTagHover?.(index)}
                            >
                                {tag}
                            </button>
                        ))
                    ) : (
                        <div className="tag-suggestion-empty">
                            No tags found
                        </div>
                    )}
                </div>
            )}

            <div className="chat-input-wrapper">

                <textarea
                    ref={inputRef}
                    value={value}
                    onChange={handleChange}
                    placeholder={placeholder || t('chat.placeholder')}
                    onKeyDown={onKeyDown}
                    className="chat-textarea"
                    rows={1}
                    disabled={disabled}
                />
                <button
                    type="button"
                    onClick={onSend}
                    disabled={loading || !value.trim() || disabled}
                    className="chat-send-button"
                >
                    {loading ? (
                        <div className="spinner" />
                    ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <title>Send</title>
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                    )}
                </button>
            </div>
        </div>
    );
};
