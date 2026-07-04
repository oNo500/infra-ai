.PHONY: help check sync list
.DEFAULT_GOAL := help

help: ## List all commands
	@grep -E '^[a-zA-Z0-9_-]+:.*##' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*##"} {printf "  %-10s %s\n", $$1, $$2}'

check: ## Check mirror upstreams for updates (read-only)
	@scripts/sync-skills.sh check

sync: ## Sync updated mirrors into skills/ (no commit)
	@scripts/sync-skills.sh update

list: ## List all skills and their source (reads skills.json)
	@jq -r '.[] | "  \(.name)\t[\(.source)]\t" + \
		(if .source == "mirror" then .repo \
		 elif .source == "official" then "plugin: " + .plugin \
		 else "local" end)' skills.json | column -t -s "$$(printf '\t')"
