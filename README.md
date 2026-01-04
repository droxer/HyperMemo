<div align="center">
  <img src="public/icons/icon.svg" alt="HyperMemo Logo" width="128" height="128" />
  <h1>HyperMemo</h1>
  <p>
    <b>Your Second Brain for the Web</b>
  </p>
  <p>
    <img alt="Teal" src="https://img.shields.io/badge/Primary-0d9488?style=flat-square" />
    <img alt="Amber" src="https://img.shields.io/badge/Accent-f59e0b?style=flat-square" />
  </p>
  <p>
    A Chrome extension that helps you save, organize, and explore your bookmarks.<br/>
    Ask questions about your saved content and get answers with sources.<br/>
    Build notes from your bookmarks and export them to Google Docs.
  </p>
</div>

## Features
- **Quick capture**: Save any webpage with one click. Get AI-generated summaries and suggested tags to help you organize your bookmarks.
- **Chat with your bookmarks**: Ask questions about your saved content and get answers with links back to the original sources.
- **Note builder** (Coming Soon): Convert AI chat conversations into structured notes and export them to Google Docs.
- **Secure authentication**: Sign in with your Google account to keep your bookmarks private and synced.

## Roadmap

### Phase 1: Core Experience
- [x] Chrome Extension for quick capture
- [x] AI-powered summarization and tagging
- [x] RAG-based chat with bookmarks
- [x] Basic dashboard for management

### Phase 2: Enhanced Organization
- [ ] **Note Builder**: Create structured notes from AI chat conversations
- [ ] **Google Docs Export**: One-click export of research notes
- [ ] **Advanced Filtering**: Filter by date, domain, and read status
- [ ] **Full-text Search**: Search within the content of saved pages

### Phase 3: Expansion & Integration
- [ ] **Mobile App**: iOS and Android apps for on-the-go access
- [ ] **Knowledge Graph**: Visual exploration of connected ideas
- [ ] **Integrations**: Sync with Notion, Obsidian, and Readwise
- [ ] **Collaboration**: Shared collections and team workspaces

## Setup
```bash
make frontend-install   # Install dependencies
make frontend-dev       # Start Vite dev server
make frontend-build     # Production build
make frontend-lint      # Run Biome lint
make frontend-test      # Run Vitest suite (jsdom)
make backend-test       # Run Deno unit tests for Edge helpers
```
If pnpm warns about ignored install scripts, run `pnpm approve-builds` once to whitelist them.

## Environment
Create `.env` (or `.env.local`) with:
```
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_FUNCTION_URL=https://YOUR_PROJECT_REF.functions.supabase.co # optional override
VITE_SUPABASE_PUBLISHABLE_KEY=...
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

## Documentation

- [Subscription System](./docs/SUBSCRIPTION_SYSTEM.md): Details on Free/Pro tiers, feature gating, and management.

- [Release Guide](./docs/release.md): Steps to build, package, and publish the extension.
- [Authentication](./docs/authentication.md): Setup guide for Google OAuth and backend security.

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
make backend-db         # applies SQL migrations
make backend-functions  # deploys bookmarks, summaries, rag_query, notes
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

## Testing

| Area      | Command               | Notes |
|-----------|-----------------------|-------|
| Frontend  | `make frontend-test`  | Runs Vitest with jsdom (components + services). |
| Backend   | `make backend-test`   | Executes Deno tests in `supabase/functions`. |
| Pre-commit| `npx lint-staged` + tests | Husky hook invokes lint-staged, Vitest, and Deno tests before every commit. |

To run everything manually:

```bash
make frontend-lint frontend-test
make backend-lint backend-test
```

## Backend expectations
- `/bookmarks` (GET/POST/PUT/DELETE) stores bookmark metadata and embeddings through Supabase Edge Functions into Postgres.
- `/summaries` and `/summaries/tags` call OpenAI (configurable) to summarize content and propose tags.
- `/rag_query` embeds the question with OpenAI, performs cosine similarity scoring against stored vectors, and responds with `{ answer, matches }`.
- `/notes/export` takes `{ note }`, is currently unimplemented, and should be handled by a future Supabase function that exchanges the Supabase session for Google APIs.

## Project layout
- `src/pages/popup` – capture UI + styles.
- `src/pages/dashboard` – chat workspace + note builder.
- `src/services` – Supabase client, API client, bookmark/notes/RAG helpers.
- `src/background` / `src/content` – Chrome runtime scripts for page capture.
- `pages/` – HTML entrypoints consumed by Vite/CRXJS.

Feel free to extend the Service Worker, add offline caching, or plug in additional API endpoints (analytics, spaced repetition, etc.) as the backend grows.
