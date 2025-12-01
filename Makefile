.PHONY: frontend-install frontend-dev frontend-build frontend-lint backend-db backend-functions backend-lint clean build-prod package release validate-build

SUPABASE ?= supabase
VERSION := $(shell node -p "require('./package.json').version")
DIST_DIR := dist
RELEASE_DIR := release
PACKAGE_NAME := hypermemo-$(VERSION).zip

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
	$(SUPABASE) functions deploy bookmarks summaries rag_query notes --import-map supabase/functions/deno.json

backend-lint: ## Run Deno lint on backend functions
	deno lint supabase/functions

clean: ## Remove build artifacts and caches
	rm -rf dist
	rm -rf supabase/.temp
	rm -rf $(RELEASE_DIR)

build-prod: clean frontend-lint ## Build production-ready extension
	@echo "🏗️  Building production extension v$(VERSION)..."
	@pnpm run build
	@echo "✅ Production build complete!"

validate-build: ## Validate the production build
	@echo "🔍 Validating build..."
	@test -d $(DIST_DIR) || (echo "❌ dist/ directory not found. Run 'make build-prod' first." && exit 1)
	@test -f $(DIST_DIR)/manifest.json || (echo "❌ manifest.json not found in dist/" && exit 1)
	@test -f $(DIST_DIR)/pages/popup/index.html || (echo "❌ popup page not found" && exit 1)
	@test -f $(DIST_DIR)/pages/dashboard/index.html || (echo "❌ dashboard page not found" && exit 1)
	@echo "✅ Build validation passed!"

package: build-prod validate-build ## Package extension for Chrome Web Store
	@echo "📦 Packaging extension v$(VERSION)..."
	@mkdir -p $(RELEASE_DIR)
	@cd $(DIST_DIR) && zip -r ../$(RELEASE_DIR)/$(PACKAGE_NAME) . -x "*.map" "*.DS_Store"
	@echo "✅ Package created: $(RELEASE_DIR)/$(PACKAGE_NAME)"
	@ls -lh $(RELEASE_DIR)/$(PACKAGE_NAME)

release: package ## Create release package and show upload instructions
	@echo ""
	@echo "🚀 Release package ready!"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "📦 Package: $(RELEASE_DIR)/$(PACKAGE_NAME)"
	@echo "📊 Version: $(VERSION)"
	@echo "📏 Size: $$(du -h $(RELEASE_DIR)/$(PACKAGE_NAME) | cut -f1)"
	@echo ""
	@echo "📋 Next Steps:"
	@echo "  1. Go to: https://chrome.google.com/webstore/devconsole"
	@echo "  2. Click 'New Item' or select existing extension"
	@echo "  3. Upload: $(RELEASE_DIR)/$(PACKAGE_NAME)"
	@echo "  4. Fill in store listing details"
	@echo "  5. Submit for review"
	@echo ""
	@echo "📝 Release Checklist:"
	@echo "  ✓ Code linted and type-checked"
	@echo "  ✓ Production build created"
	@echo "  ✓ Build validated"
	@echo "  ✓ Package created and ready"
	@echo ""
	@echo "⚠️  Remember to:"
	@echo "  - Update CHANGELOG.md"
	@echo "  - Create git tag: git tag v$(VERSION)"
	@echo "  - Push tag: git push origin v$(VERSION)"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
