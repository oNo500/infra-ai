.PHONY: help meta
.DEFAULT_GOAL := help

help: ## List all commands
	@grep -E '^[a-zA-Z0-9_-]+:.*##' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*##"} {printf "  %-10s %s\n", $$1, $$2}'

meta: ## Launch meta-cli TUI (reconcile/build/dist/writeback)
	@pnpm meta
