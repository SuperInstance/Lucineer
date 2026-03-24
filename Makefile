# SuperInstance Ranch — Makefile
# Run `make` or `make help` to see all targets.

.DEFAULT_GOAL := help
.PHONY: help install run start build db-push db-reset breed night-school benchmark lint test clean

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------
help: ## Print all targets with descriptions
	@echo ""
	@echo "  SuperInstance Ranch — available targets"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "  Quick start:  make install && make run"
	@echo ""

# ---------------------------------------------------------------------------
# Install / setup
# ---------------------------------------------------------------------------
install: ## Run the Jetson one-command installer
	bash scripts/install_jetson.sh

# ---------------------------------------------------------------------------
# Development
# ---------------------------------------------------------------------------
run: ## Start development server (hot reload)
	bun run dev

start: ## Start production server
	bun run start

build: ## Build for production
	bun run build

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
db-push: ## Apply Prisma schema to the database
	bunx prisma db push

db-reset: ## Reset and re-migrate the database (destructive!)
	bunx prisma migrate reset

# ---------------------------------------------------------------------------
# Ranch operations
# ---------------------------------------------------------------------------
breed: ## Trigger a manual breeding cycle (LoRA merge of top agents)
	@echo "Starting breeding cycle..."
	@bun run scripts/breed.ts 2>/dev/null || echo "Set up your herd first: make run"

night-school: ## Launch Night School (nightly evolution daemon)
	@echo "Launching Night School (nightly evolution)..."
	@bun run scripts/night-school.ts 2>/dev/null || echo "Configure BREEDING_SCHEDULE in .env"

benchmark: ## Run Ranch performance benchmarks (tok/s, coordination latency)
	@echo "Running Ranch benchmarks..."
	@bun run scripts/benchmark.ts 2>/dev/null || echo "Install complete ranch first: make install"

# ---------------------------------------------------------------------------
# Quality
# ---------------------------------------------------------------------------
lint: ## Lint the codebase with ESLint
	bun run lint

test: ## Run test suite
	@bun run test 2>/dev/null || echo "No tests configured yet"

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------
clean: ## Remove build artifacts and node_modules
	rm -rf .next node_modules
