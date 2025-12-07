# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HyperMemo is a Chrome extension that acts as a "second brain for the web" - helping users save, organize, and explore bookmarks with AI-powered features including:
- Quick capture with AI-generated summaries and tags
- RAG-powered chat over saved bookmarks
- Tag-based organization
- Google Docs export (planned)
- Free/Pro subscription tiers

**Tech Stack:**
- Frontend: React 18 + TypeScript + Vite + CRXJS
- Backend: Supabase Edge Functions (Deno runtime)
- Database: Postgres with pgvector extension for embeddings
- AI: OpenAI (summaries, tags, embeddings, RAG)
- Testing: Vitest (frontend) + Deno test (backend)
- Linting: Biome (frontend) + Deno lint (backend)

## Development Commands

### Frontend (Chrome Extension)
```bash
make frontend-install   # Install dependencies (or: pnpm install)
make frontend-dev       # Start Vite dev server (or: pnpm run dev)
make frontend-build     # Type-check + production build (or: pnpm run build)
make frontend-lint      # Run Biome linter (or: pnpm run lint)
make frontend-test      # Run Vitest tests (or: pnpm vitest run)
pnpm vitest            # Run tests in watch mode
pnpm vitest src/services/bookmarkService.test.ts  # Run a single test file
```

### Backend (Supabase Edge Functions)
```bash
make backend-db         # Apply SQL migrations (or: supabase db push)
make backend-functions  # Deploy all Edge Functions
make backend-lint       # Run Deno linter (or: deno lint supabase/functions)
make backend-test       # Run Deno tests (or: deno test supabase/functions)
deno test supabase/functions/_shared/bookmarks_test.ts  # Run a single test file
```

### Release
```bash
make release           # Build, validate, package for Chrome Web Store
```

### Admin Scripts
```bash
pnpm run sub           # Manage user subscriptions (tsx scripts/manage-subscription.ts)
pnpm run stats         # View admin statistics (tsx scripts/admin-stats.ts)
```

## Architecture

### Frontend Structure
- **`src/pages/popup/`** - Quick capture UI shown when clicking extension icon
- **`src/pages/dashboard/`** - Full dashboard with chat and note builder
- **`src/background/`** - Service worker for Chrome runtime APIs
- **`src/content/`** - Content scripts injected into web pages for scraping
- **`src/services/`** - API client and service layer (see Service Layer pattern below)
- **`src/contexts/`** - React contexts (AuthContext, BookmarkContext)
- **`src/components/`**, **`src/types/`**, **`src/utils/`**, **`src/i18n/`** - Components, types, utilities, i18n

**Path Aliases:** `@/components/*`, `@/services/*`, `@/contexts/*`, `@/hooks/*`, `@/types/*`, `@/utils/*`

### Backend Structure (Supabase Edge Functions)
All Edge Functions are in `supabase/functions/`:
- **`bookmarks/`** - CRUD operations for bookmarks with AI summaries and embeddings
- **`summaries/`** - AI-powered summary and tag generation endpoints
- **`tags/`** - CRUD operations for tags with bookmark counts
- **`rag_query/`** - Hybrid semantic + tag-based search using RAG
- **`process-bookmark/`** - Background processing for bookmark content extraction and embeddings
- **`notes/`** - Placeholder for Google Docs export (not implemented)
- **`_shared/`** - Shared utilities across all functions:
  - `ai.ts` - OpenAI integration
  - `cors.ts`, `response.ts`, `request.ts` - HTTP helpers
  - `supabaseClient.ts` - Supabase client setup
  - `bookmarks.ts`, `tagUtils.ts` - Business logic and types
  - `prompts.ts` - AI prompt templates
  - `env.ts` - Environment variable handling

**Edge Function Pattern:** All functions follow this structure:
```typescript
Deno.serve(async (req: Request): Promise<Response> => {
  // 1. Handle CORS preflight
  const cors = handleCors(req);
  if (cors) return cors;

  // 2. Require authentication and get user_id
  const userId = await requireUserId(req);

  // 3. Route and handle business logic
  // ...

  // 4. Return JSON response with CORS headers
});
```

### Database Schema
- **`bookmarks`** table stores title, url, summary, raw_content, embedding vector
- **`tags`** table stores tag names per user
- **`bookmark_tags`** junction table for many-to-many relationship
- **`user_profiles`** stores subscription tier (free/pro)
- Row-level security (RLS) enforces user isolation
- Auto-updated `updated_at` triggers on bookmarks

See `supabase/migrations/` for full schema.

### Key Architectural Patterns

**1. Dual Environments (Testing & Linting):**
- Frontend: Vitest + Biome for `src/**/*.{ts,tsx}`
- Backend: Deno test + Deno lint for `supabase/functions/**/*.ts`
- Pre-commit hook (Husky + lint-staged) runs appropriate tools based on file path

**2. Service Layer:**
Frontend services in `src/services/` abstract Edge Function calls via `apiClient.ts`:
- `bookmarkService.ts`, `tagService.ts`, `ragService.ts`, `subscriptionService.ts`
- `auth/chromeIdentity.ts` - Google OAuth via Chrome Identity API

**3. Subscription System:**
- Free tier: 50 bookmarks, 5 tags per bookmark
- Pro tier: Unlimited bookmarks and tags
- Feature gating in `subscriptionService.ts`
- Admin CLI tools in `scripts/` for subscription management

**4. RAG Implementation:**
- Embeddings computed via OpenAI on bookmark creation
- Hybrid scoring: semantic similarity (cosine) + tag matching boost
- In-memory ranking (no vector database yet, loads all user bookmarks)
- Top 5 results by default with source attribution

**5. Chrome Extension Architecture:**
- Manifest v3 with service worker background script
- Two HTML pages: popup (quick capture) and dashboard (full UI)
- Content scripts for page content extraction
- Chrome Identity API for Google OAuth
- Storage API for local caching

## Environment Variables

### Frontend (.env or .env.local)
```
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_FUNCTION_URL=https://YOUR_PROJECT_REF.functions.supabase.co  # optional
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_GOOGLE_OAUTH_CLIENT_ID=...
VITE_AUTO_ANON_LOGIN=false
VITE_AUTH_WAIT_TIMEOUT_MS=5000
```

### Backend (Supabase Secrets)
Set via `supabase secrets set KEY=VALUE`:
```
OPENAI_API_KEY=...           # Required
OPENAI_MODEL=...             # Optional, defaults to gpt-4o-mini
OPENAI_EMBEDDING_MODEL=...   # Optional, defaults to text-embedding-3-small
OPENAI_BASE_URL=...          # Optional, for compatible providers
AI_PROVIDER=openai           # Currently only openai supported
REQUIRE_AUTH=true            # Set false for local dev
ANON_UID=...                 # Fallback user for local dev
```

## Important Development Notes

**When working with Edge Functions:**
- Import shared utilities from `../_shared/` (relative imports)
- Use `deno.json` for import maps: `jsr:` for Deno packages, `npm:` for Node modules
- All database queries MUST filter by `user_id` for security
- Always use `requireUserId(req)` for authentication
- Use `jsonResponse()` helper to ensure CORS headers
- Test with `deno test supabase/functions` before deploying

**When working with Frontend:**
- Use path aliases (`@/...`) not relative paths for src imports
- All API calls go through service layer, not direct Supabase client
- Chrome APIs accessed via `chrome.*` (types from `@types/chrome`)
- Biome allows both `let` and `const` (`useConst: off`)

**Chrome Extension Testing:**
1. Run `make frontend-dev` to start Vite dev server
2. Load unpacked extension from `dist/` directory in Chrome
3. Changes hot-reload automatically during development
4. Check `chrome://extensions` for manifest errors
5. Use Chrome DevTools for popup and background script debugging

**Database Changes:**
1. Create migration: `supabase migration new <name>`
2. Write SQL in `supabase/migrations/<timestamp>_<name>.sql`
3. Apply locally: `supabase db push`
4. Test thoroughly before deploying to production

**Deployment:**
- Frontend: Build with `make release`, upload to Chrome Web Store
- Backend: Deploy functions with `make backend-functions`
- Database: Migrations auto-applied via Supabase CLI or GitHub Actions

## Common Patterns

**Adding a new Edge Function endpoint:**
1. Create directory in `supabase/functions/<name>/`
2. Create `index.ts` with `Deno.serve()` handler
3. Use `handleCors()` and `requireUserId()` from `_shared/`
4. Add to deploy command in Makefile
5. Add tests in same directory or `_shared/`

**Adding a new frontend service:**
1. Create service file in `src/services/<name>Service.ts`
2. Use `apiClient` for HTTP calls to Edge Functions
3. Export typed functions for each operation
4. Add tests in `src/services/<name>Service.test.ts`
5. Import and use in components/contexts

**Tag handling:**
- Always lowercase and trim tag names
- Maximum 5 tags per bookmark (enforced in Edge Functions)
- Tags are per-user (user_id in tags table)
- Use `normalizeTags()` from `_shared/bookmarks.ts`

**Error handling:**
- Backend: Try-catch in handler, return appropriate HTTP status
- Frontend: Services throw errors, components handle with error states
- Use ErrorBoundary component for React error boundaries

## Documentation


- [docs/release.md](docs/release.md) - Release process for Chrome Web Store
- [docs/google-auth.md](docs/google-auth.md) - Google OAuth setup guide
- [docs/admin-cli.md](docs/admin-cli.md) - Admin CLI tools documentation
- [README.md](README.md) - Project overview and setup instructions

## Version Management

- Version defined in `package.json` (single source of truth)
- Manifest version synced during build
- `make release` packages with version from package.json
- Update CHANGELOG.md and create git tags for releases
