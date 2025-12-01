.PHONY: frontend-install frontend-dev frontend-build frontend-lint backend-db backend-functions backend-lint clean

SUPABASE ?= supabase

frontend-install: ## Install front-end dependencies
	pnpm install

frontend-dev: ## Start Vite dev server (Chrome extension)
	pnpm run dev

frontend-build: ## Type-check and produce production build
	pnpm run build

frontend-lint: ## Run Biome lint
	pnpm run lint

backend-db: ## Apply SQL migrations to the linked Supabase project
	$(SUPABASE) db push

backend-functions: ## Deploy Supabase Edge Functions
	$(SUPABASE) functions deploy bookmarks summaries rag_query notes

backend-lint: ## Run Deno lint on backend functions
	deno lint supabase/functions

clean: ## Remove build artifacts and caches
	rm -rf dist
	rm -rf supabase/.temp
