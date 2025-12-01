export interface TagSummary {
    id: string;
    name: string;
    bookmarkCount: number;
    userId?: string;
    createdAt?: string;
}

export type TagPayload = {
    name: string;
};
