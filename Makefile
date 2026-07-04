.PHONY: help check sync
.DEFAULT_GOAL := help

help: ## List all commands
	@grep -E '^[a-zA-Z0-9_-]+:.*##' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*##"} {printf "  %-10s %s\n", $$1, $$2}'

check: ## Check mirror upstreams for updates (read-only)
	@scripts/sync-skills.sh check

sync: ## Sync updated mirrors into skills/ (no commit)
	@scripts/sync-skills.sh update
