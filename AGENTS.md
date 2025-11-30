# Repository Guidelines

## Project Structure & Module Organization
- `src/` holds TypeScript sources: popup/dashboard React UIs (`src/pages/**`), contexts (`src/contexts`), Chrome scripts (`src/background`, `src/content`), and domain services (`src/services`).  
- Static HTML entry points live under `pages/`, while icons reside in `public/icons`.  
- `supabase/` contains the SQL schema and Edge Functions (bookmarks, summaries, tags, RAG).  
- Build artifacts are emitted to `dist/` after running `pnpm run build`. Avoid hand-editing generated files.

## Build, Test, and Development Commands
- Front-end: `pnpm install`, `pnpm run dev`, `pnpm run build`, `pnpm run lint`.  
- Makefile shortcuts: `make install`, `make front-dev`, `make front-build`, `make front-lint`, `make supabase-db`, `make supabase-functions`.  
- Backend workflow: `supabase db push` applies migrations, and `supabase functions deploy bookmarks summaries summary-tags rag-query` publishes the Edge Functions (ensure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and OpenAI env vars are set).

## Coding Style & Naming Conventions
- TypeScript/React code uses ES modules, React 18 function components, and absolute imports via the `@/` alias.  
- Prefer descriptive camelCase for variables/functions and PascalCase for components/context providers.  
- Run `pnpm run lint` before committing; Biome enforces spacing, quote style, and basic best practices. Keep files ASCII unless a dependency already uses Unicode.

## Testing Guidelines

### Manual Verification
Currently, the primary testing method is manual verification using the unpacked extension.

1. **Dev Server**: Run `pnpm run dev` to watch and compile to `dist/`.
2. **Chrome Setup**:
   - Navigate to `chrome://extensions/`.
   - Enable **Developer mode**.
   - Click **Load unpacked** and select the project's `dist/` folder.
3. **Key Scenarios**:
   - **Popup**: Ensure the extension opens and can capture the active tab.
   - **Dashboard**: Verify the RAG chat responds and notes can be created/exported.
- **Services**: Check the console for any API or Supabase errors.

### Static Analysis
- **Linting**: `pnpm run lint` (Biome) checks for formatting and code quality.
- **Type Checking**: `pnpm run build` performs a full TypeScript check.

### Automated Testing (Future)
- **Framework**: Vitest is the planned test runner.
- **Structure**: Tests should be co-located with source files (e.g., `src/services/bookmarkService.test.ts`).
- **Scope**: Prioritize unit tests for `src/services` and integration tests for the main flows.

## Commit & Pull Request Guidelines
- Use conventional, action-oriented commit messages (e.g., `feat: add popup summary autosuggest`).  
- Each pull request should include: purpose summary, screenshots/gifs for UI changes (popup + dashboard), and references to related issues.  
- Verify `pnpm run build` and `pnpm run lint` succeed before requesting review; attach any manual test notes (e.g., “loaded unpacked extension in Chrome 129”).

## Security & Configuration Tips
- Store Supabase, OpenAI, and Google API credentials in `.env` files (prefixed with `VITE_…` for the client, regular env vars for functions); never commit secrets.  
- When implementing Drive exports or real RAG backends, route privileged calls through Supabase Edge Functions or another server-side layer to keep tokens out of the extension bundle.
