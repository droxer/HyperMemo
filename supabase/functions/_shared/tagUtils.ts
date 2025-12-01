export type TagRelation<T> = T[] | T | null | undefined;

export function normalizeTagResult<T>(value: TagRelation<T>): T[] {
    if (Array.isArray(value)) {
        return value;
    }
    if (value) {
        return [value];
    }
    return [];
}
