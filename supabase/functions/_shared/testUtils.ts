export function assert(condition: unknown, message = 'Assertion failed'): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

export function assertEquals<T>(actual: T, expected: T, message?: string): void {
    const actualJson = JSON.stringify(actual);
    const expectedJson = JSON.stringify(expected);
    if (actualJson !== expectedJson) {
        throw new Error(
            message ??
            `Assertion failed: expected ${expectedJson ?? 'undefined'}, received ${actualJson ?? 'undefined'}`
        );
    }
}
