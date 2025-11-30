.PHONY: frontend-install frontend-dev frontend-build frontend-lint supabase-db supabase-functions clean

SUPABASE ?= supabase

frontend-install: ## Install front-end dependencies
	pnpm install

frontend-dev: ## Start Vite dev server (Chrome extension)
	pnpm run dev

frontend-build: ## Type-check and produce production build
	pnpm run build

frontend-lint: ## Run Biome lint
	pnpm run lint

supabase-db: ## Apply SQL migrations to the linked Supabase project
	$(SUPABASE) db push

supabase-functions: ## Deploy Supabase Edge Functions
	$(SUPABASE) functions deploy bookmarks summaries rag_query notes

clean: ## Remove build artifacts and caches
	rm -rf dist
	rm -rf supabase/.temp
