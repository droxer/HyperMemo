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
`VITE_API_BASE_URL` should point to the Firebase HTTPS Functions base URL (2nd gen, Python runtime) that calls Vertex AI for summaries/embeddings and orchestrates Firestore + Google Docs operations.

## Firebase Functions (Python)
Backend code lives in `functions/` and targets Python 3.11 with the Firebase Functions SDK. You can either call the commands manually or rely on the new Makefile helpers (`make backend-install`, `make backend-deploy`):

```bash
cd functions
uv venv --python 3.11
uv pip install -r requirements.txt  # installs firebase-functions, firebase-admin, google-cloud-firestore>=2.19.0, etc.
firebase login
firebase functions:config:set vertex.location="us-central1"  # optional overrides
firebase deploy --only functions
```

Endpoints exposed:

- `bookmarks`: GET/POST upserts with Vertex summaries/tags + embeddings saved to Firestore.
- `summaries` / `summary_tags`: lightweight Gemini helpers for the popup.
- `rag_query`: embeds the user question, compares against stored vectors, and returns `{ answer, matches }`.
- `export_note`: placeholder for Google Docs export (wire OAuth + Docs API before production).

## Backend expectations
- `/bookmarks` (GET/POST/PUT/DELETE) stores bookmark metadata and embeddings through Firebase Cloud Functions into your vector store.
- `/summaries` and `/summaries/tags` call Vertex AI (directly or via Firebase Genkit/Firebase Extensions) to summarize content and propose tags.
- `/rag/query` embeds the question with Vertex AI, performs similarity search (BigQuery vector search, AlloyDB pgvector, or Vertex AI Search), and responds with `{ answer, matches }`.
- `/notes/export` takes `{ note }`, verifies the Firebase ID token, exchanges it for Drive/Docs credentials (using chrome.identity or Google Identity Toolkit), and returns `{ exportUrl, driveFileId }`.

## Project layout
- `src/pages/popup` – capture UI + styles.
- `src/pages/dashboard` – chat workspace + note builder.
- `src/services` – Firebase wiring, API client, bookmark/notes/RAG helpers.
- `src/background` / `src/content` – Chrome runtime scripts for page capture.
- `pages/` – HTML entrypoints consumed by Vite/CRXJS.

Feel free to extend the Service Worker, add offline caching, or plug in additional API endpoints (analytics, spaced repetition, etc.) as the backend grows.
