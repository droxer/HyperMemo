# HyperMemo

A Chrome extension that helps you save, organize, and explore your bookmarks. Ask questions about your saved content and get answers with sources. Build notes from your bookmarks and export them to Google Docs.

## Features
- **Quick capture**: Save any webpage with one click. Get AI-generated summaries and suggested tags to help you organize your bookmarks.
- **Chat with your bookmarks**: Ask questions about your saved content and get answers with links back to the original sources.
- **Note builder**: Select bookmarks, write notes, and export everything to Google Docs with a single click.
- **Secure authentication**: Sign in with your Google account to keep your bookmarks private and synced.

## Setup
```bash
pnpm install
pnpm run dev        # Vite dev server + CRX reloader (load dist/ as unpacked extension)
pnpm run build      # type-check + production build into dist/
pnpm run lint       # Biome formatting + lint rules
```
If pnpm warns about ignored install scripts (e.g., `@firebase/util`, `esbuild`), run `pnpm approve-builds` once to whitelist them.

## Environment
Create `.env` (or `.env.local`) with:
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_API_BASE_URL=https://your-api-gateway.example.com
```
`VITE_API_BASE_URL` should point to the API layer that talks to Bedrock for embeddings/summaries, writes embeddings to Aurora pgvector, and exports notes to Google Docs.

Feel free to extend the Service Worker, add offline caching, or plug in additional API endpoints (e.g., analytics, spaced repetition) as the backend grows.
