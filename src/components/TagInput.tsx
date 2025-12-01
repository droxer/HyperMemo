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

    return (
        <div className="tag-input">
            <div className="tag-input__chips">
                {value.map((tag) => (
                    <button key={tag} type="button" onClick={() => removeTag(tag)}>
                        {tag} ×
                    </button>
                ))}
            </div>
            <input
                id={id}
                className="tag-input__field"
                placeholder={placeholder ?? 'Add tag'}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ',') {
                        event.preventDefault();
                        addTag(input);
                    }
                }}
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
