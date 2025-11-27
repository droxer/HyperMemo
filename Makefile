.PHONY: install front-dev front-build front-lint backend-venv backend-install backend-serve backend-deploy clean

install: ## Install front-end dependencies
	pnpm install

front-dev: ## Start Vite dev server (Chrome extension)
	pnpm run dev

front-build: ## Type-check and produce production build
	pnpm run build

front-lint: ## Run Biome lint
	pnpm run lint

backend-venv: ## Create Python virtualenv for Firebase Functions
	cd functions && uv venv --python 3.11

backend-install: backend-venv ## Install backend Python dependencies
	cd functions && uv pip install --upgrade pip && uv pip install -r requirements.txt

backend-serve: ## Run Firebase emulator for functions
	cd functions && . .venv/bin/activate && firebase emulators:start --only functions

backend-deploy: ## Deploy Firebase Functions (Python)
	cd functions && . .venv/bin/activate && firebase deploy --only functions

clean: ## Remove build artifacts and caches
	rm -rf dist
	rm -rf functions/lib functions/.venv functions/__pycache__
