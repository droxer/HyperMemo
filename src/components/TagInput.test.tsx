import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TagInput } from './TagInput';

describe('TagInput', () => {
    it('adds normalized tags on Enter', () => {
        const handleChange = vi.fn();
        const { getByPlaceholderText } = render(
            <TagInput value={[]} onChange={handleChange} placeholder="Add tag" />
        );

        const input = getByPlaceholderText('Add tag') as HTMLInputElement;
        fireEvent.change(input, { target: { value: '  Alpha  ' } });
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

        expect(handleChange).toHaveBeenCalledWith(['Alpha']);
    });

    it('does not add duplicate tags', () => {
        const handleChange = vi.fn();
        const { getByRole } = render(<TagInput value={['Alpha']} onChange={handleChange} />);

        const input = getByRole('textbox') as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'Alpha' } });
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

        expect(handleChange).not.toHaveBeenCalled();
    });

    it('removes tag via chip button', () => {
        const handleChange = vi.fn();
        const { getByTitle } = render(<TagInput value={['Alpha']} onChange={handleChange} />);

        fireEvent.click(getByTitle('Remove Alpha'));
        expect(handleChange).toHaveBeenCalledWith([]);
    });

    it('removes last tag with backspace when input empty', () => {
        const handleChange = vi.fn();
        const { getByRole } = render(<TagInput value={['Alpha']} onChange={handleChange} />);

        const textbox = getByRole('textbox') as HTMLInputElement;
        fireEvent.keyDown(textbox, { key: 'Backspace', code: 'Backspace' });

        expect(handleChange).toHaveBeenCalledWith([]);
    });
});
