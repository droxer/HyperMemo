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
If pnpm warns about ignored install scripts, run `pnpm approve-builds` once to whitelist them.

## Environment
Create `.env` (or `.env.local`) with:
```
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_FUNCTION_URL=https://YOUR_PROJECT_REF.functions.supabase.co # optional override
VITE_SUPABASE_ANON_KEY=...
VITE_GOOGLE_OAUTH_CLIENT_ID=...
VITE_AUTO_ANON_LOGIN=false
VITE_AUTH_WAIT_TIMEOUT_MS=5000
```

`VITE_SUPABASE_FUNCTION_URL` defaults to `https://<project-ref>.functions.supabase.co`; set it explicitly if you use a custom domain.

Set `VITE_AUTO_ANON_LOGIN=true` only if you have [Supabase anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous) enabled in your project; otherwise leave it `false` to avoid unnecessary `/auth/v1/signup` attempts.

## Supabase Edge Functions
Backend code now lives under `supabase/`:

- `supabase/migrations` defines the bookmark table (Postgres + RLS + auto `updated_at` triggers).
- `supabase/functions/**` contains Deno-based Edge Functions for bookmarks, summaries, tags, and RAG chat.

Use the Supabase CLI (or GitHub Action) to push schema changes and deploy functions:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push                           # applies SQL migrations
supabase functions deploy bookmarks summaries summary-tags rag-query \
  --project-ref YOUR_PROJECT_REF
```

Environment variables consumed by the functions (set via `supabase functions secrets set ...`):

- `OPENAI_API_KEY` (required) plus optional overrides `OPENAI_MODEL`, `OPENAI_EMBEDDING_MODEL`, `OPENAI_BASE_URL`.
- `AI_PROVIDER=openai` (currently the only supported provider).
- `REQUIRE_AUTH=true|false` and `ANON_UID` for local/dev scenarios.

Endpoints exposed:

- `bookmarks`: GET/POST/PUT/DELETE persists bookmark metadata + embeddings to Postgres.
- `summaries` / `summary-tags`: lightweight OpenAI helpers for the popup.
- `rag-query`: embeds the user question, scores saved bookmarks in-memory, and responds with `{ answer, matches }`.
- `notes/export`: (TODO) placeholder for Google Docs export—wire your own Drive workflow when ready.

## Backend expectations
- `/bookmarks` (GET/POST/PUT/DELETE) stores bookmark metadata and embeddings through Supabase Edge Functions into Postgres.
- `/summaries` and `/summaries/tags` call OpenAI (configurable) to summarize content and propose tags.
- `/rag_query` embeds the question with OpenAI, performs cosine similarity scoring against stored vectors, and responds with `{ answer, matches }`.
- `/notes/export` takes `{ note }`, is currently unimplemented, and should be handled by a future Supabase function that exchanges the Supabase session for Google APIs.

## Project layout
- `src/pages/popup` – capture UI + styles.
- `src/pages/dashboard` – chat workspace + note builder.
- `src/services` – Firebase wiring, API client, bookmark/notes/RAG helpers.
- `src/background` / `src/content` – Chrome runtime scripts for page capture.
- `pages/` – HTML entrypoints consumed by Vite/CRXJS.

Feel free to extend the Service Worker, add offline caching, or plug in additional API endpoints (analytics, spaced repetition, etc.) as the backend grows.
