import { useState } from 'react';

export type TagInputProps = {
    value: string[];
    onChange: (next: string[]) => void;
    placeholder?: string;
    id?: string;
};

export function TagInput({ value, onChange, placeholder, id }: TagInputProps) {
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
        <div className="tag-input">
            <div className="tag-input__chips">
                {value.map((tag) => (
                    <span key={tag} className="tag-chip">
                        {tag}
                        <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="tag-remove"
                            title={`Remove ${tag}`}
                        >
                            ×
                        </button>
                    </span>
                ))}
            </div>
            <input
                id={id}
                className="tag-input__field"
                placeholder={value.length === 0 ? (placeholder ?? 'Add tag') : ''}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
            />
            <button
                type="button"
                className="tag-input__add"
                onClick={() => addTag(input)}
            >
                +
            </button>
        </div>
    );
}
