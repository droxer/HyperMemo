import { useState, memo } from 'react';

export type TagInputProps = {
    value: string[];
    onChange: (next: string[]) => void;
    placeholder?: string;
    id?: string;
};

export const TagInput = memo(function TagInput({ value, onChange, placeholder, id }: TagInputProps) {
    const [input, setInput] = useState('');

    const addTag = (tag: string) => {
        const normalized = tag.trim();
        if (!normalized || value.includes(normalized)) return;
        onChange([...value, normalized]);
        setInput('');
    };

    const removeTag = (tag: string) => {
        onChange(value.filter((item) => item !== tag));
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            addTag(input);
        } else if (event.key === 'Backspace' && !input && value.length > 0) {
            event.preventDefault();
            removeTag(value[value.length - 1]);
        }
    };

    return (
        <div className="flex items-center gap-2 flex-wrap flex-1">
            <div className="flex flex-wrap gap-1.5">
                {value.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">
                        {tag}
                        <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="text-primary/60 hover:text-primary transition-colors"
                            title={`Remove ${tag}`}
                        >
                            ×
                        </button>
                    </span>
                ))}
            </div>
            <input
                id={id}
                className="flex-1 min-w-[120px] px-2 py-1 text-sm border-none bg-transparent outline-none placeholder:text-text-secondary"
                placeholder={value.length === 0 ? (placeholder ?? 'Add tag') : ''}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
            />
            <button
                type="button"
                className="w-6 h-6 flex items-center justify-center rounded-full text-text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
                onClick={() => addTag(input)}
            >
                +
            </button>
        </div>
    );
});
