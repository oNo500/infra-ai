.PHONY: help check sync list list-rules
.DEFAULT_GOAL := help

help: ## List all commands
	@grep -E '^[a-zA-Z0-9_-]+:.*##' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*##"} {printf "  %-10s %s\n", $$1, $$2}'

check: ## Check mirror upstreams and skills ledger (read-only)
	@r=0; scripts/sync-skills.sh check || r=1; scripts/check-ledger.sh check || r=1; exit $$r

sync: ## Sync updated mirrors and fix skills ledger (no commit)
	@scripts/sync-skills.sh update
	@scripts/check-ledger.sh fix

list: ## List installed skills grouped by plugin, with descriptions
	@scripts/list-skills.sh

list-rules: ## Reconcile rule meta sources against build artifacts
	@scripts/list-rules.sh
