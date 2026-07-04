.PHONY: help check sync list
.DEFAULT_GOAL := help

help: ## List all commands
	@grep -E '^[a-zA-Z0-9_-]+:.*##' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*##"} {printf "  %-10s %s\n", $$1, $$2}'

check: ## Check mirror upstreams and skills ledger (read-only)
	@r=0; scripts/sync-skills.sh check || r=1; scripts/check-ledger.sh check || r=1; exit $$r

sync: ## Sync updated mirrors and fix skills ledger (no commit)
	@scripts/sync-skills.sh update
	@scripts/check-ledger.sh fix

list: ## List all skills and their source (reads skills.json)
	@jq -r '.[] | "  \(.name)\t[\(.source)]\t" + \
		(if .source == "mirror" then .repo \
		 elif .source == "official" then .repo + (if .plugin then "  (anthropic plugin: " + .plugin + ")" else "" end) \
		 else "local" end)' skills.json | column -t -s "$$(printf '\t')"
