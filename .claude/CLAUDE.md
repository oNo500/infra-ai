# CLAUDE.md

**infra-ai** — Personal Claude Code infrastructure: skill definitions, agent definitions,
and MCP configuration. Used as a template and reference for other projects.

## Structure

- `skills/` — Publishable skill definitions, installable via `pnpx skills add <repo>`. Each skill has `SKILL.md` + optional `assets/` + `references/`.
- `.claude/agents/` — Custom agent definitions. One `.md` file per agent.
- `.mcp.json` — MCP server config (replace placeholder keys before use).
- `.claude/rules/` — Auto-loaded project rules (see Architecture for which files load when).

## Key Commands

```bash
# Validate a skill before committing
# → use the skill-reviewer agent, point it at skills/<name>/

# Check commit before pushing
# → use the commit-validator agent

# Context getting heavy? Run the context-manager agent first
```

## Adding a New Skill

1. `mkdir skills/<name>` and create `SKILL.md` with required frontmatter
2. Run `skill-reviewer` agent to validate
3. Run `commit-validator` agent before committing

## README Sync

`README.md` (English) and `README.zh.md` (Chinese) must stay in sync.
When updating either file, always update the other in the same commit.

## Adding a New Agent

Create `agents/<name>.md` with frontmatter: `name`, `description`, `model`, `color`.
See `architecture.md` for model selection guide.
