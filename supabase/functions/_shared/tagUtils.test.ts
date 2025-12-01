import { assertEquals } from './testUtils.ts';
import { normalizeTagResult } from './tagUtils.ts';

Deno.test('normalizeTagResult returns arrays as-is', () => {
    const values = [{ id: '1' }, { id: '2' }];
    const normalized = normalizeTagResult(values);
    assertEquals(normalized, values);
});

Deno.test('normalizeTagResult wraps single object values', () => {
    const value = { id: 'single' };
    const normalized = normalizeTagResult(value);
    assertEquals(normalized, [value]);
});

Deno.test('normalizeTagResult converts nullish values to empty array', () => {
    assertEquals(normalizeTagResult(null), []);
    assertEquals(normalizeTagResult(undefined), []);
});
