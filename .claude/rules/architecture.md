# Architecture

## Project Structure

```
infra-ai/
├── .claude/
│   ├── CLAUDE.md              # project entry point (<50 lines)
│   ├── settings.json          # permissions + env (project-scoped)
│   ├── agents/                # custom agent definitions
│   │   └── <name>.md          # one file per agent
│   └── rules/                 # auto-loaded rule files
│       ├── constitution.md    # core principles (no paths — always loaded)
│       ├── architecture.md    # this file (no paths — always loaded)
│       ├── context-management.md  # context hygiene rules (always loaded)
│       └── skills.md          # skills architecture (paths: skills/**)
├── skills/                    # publishable skill definitions — installable via `pnpx skills add`
│   └── <name>/
│       ├── SKILL.md           # entry point: frontmatter + workflow
│       ├── assets/            # template files (filled by Claude during skill use)
│       └── references/        # fill-in guides (how to use the templates)
├── .mcp.json                  # MCP server config (API keys as placeholders)
└── .gitignore
```

---

## Skills

### SKILL.md Frontmatter

Required fields:

```yaml
---
name: <matches directory name exactly>
description: >
  [What it does]. [When to trigger it — specific conditions].
  Trigger phrases: "[phrase1]", "[phrase2]".
---
```

The `description` field is what Claude uses to auto-invoke the skill. It must be specific
enough to disambiguate from other skills.

### assets/ vs references/

- `assets/` — template files that Claude fills in when executing the skill. May contain
  `[ALL_CAPS]` placeholders. Never commit with placeholders unfilled (in actual project output).
- `references/` — guides that tell Claude *how* to fill the templates. Prose, not templates.

### Naming

- Skill directory: `kebab-case`
- Asset files: `<topic>.md` (e.g. `constitution.md`, `frontend.md`)
- Reference files: `<topic>-guide.md` (e.g. `architecture-guide.md`)

---

## Agents

Each file in `agents/` defines one custom agent. Format:

```yaml
---
name: <kebab-case, matches filename without .md>
description: >
  [When to use this agent — specific triggers and examples].
  Include <example> blocks for complex invocation patterns.
model: sonnet | opus | haiku | inherit
color: green | yellow | cyan | purple | red | blue
---

[Agent system prompt — what it does, how it works, output format]
```

### Model Selection

- `haiku` — fast validators, format checkers, context assessors (low reasoning needed)
- `sonnet` — default for most agents (code review, architecture, skill review)
- `opus` — reserved for deep analysis requiring maximum reasoning
- `inherit` — uses the current session model

### High-Value Agents in This Repo

| Agent | Model | Trigger |
|-------|-------|---------|
| `skill-reviewer` | sonnet | After writing/modifying a SKILL.md |
| `commit-validator` | haiku | Before every `git commit` |
| `context-manager` | haiku | Session feels bloated, before new major task |

---

## MCP Configuration

`.mcp.json` at project root. API keys must be placeholders (not real keys) in version control.

Four-tier retrieval strategy (see `skills/ctx-init/references/mcp-guide.md`):
1. context7 — third-party library API docs
2. exa — real-world code examples, comparison analysis
3. tavily — general web search
4. Brave Search (env fallback) — last resort

---

## Rules Files

| File | paths frontmatter | Purpose |
|------|-------------------|---------|
| `constitution.md` | none (always loaded) | Non-negotiable principles |
| `architecture.md` | none (always loaded) | Structure + conventions |
| `context-management.md` | none (always loaded) | Context hygiene |
| `skills.md` | `skills/**` | Skills-specific rules |

New rule files: use `paths` frontmatter only when the rule is irrelevant outside a specific
directory. Otherwise omit it so the rule always loads.
