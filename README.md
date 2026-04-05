# Infra AI

Personal Claude Code infrastructure — skills, agents, rules, and MCP configuration.

## Install Skills

```bash
# Install all skills
pnpx skills add <this-repo>

# List available skills without installing
pnpx skills add <this-repo> --list
```

## Skills

| Skill | Description |
|-------|-------------|
| `ctx-init` | Generate `.claude/` context files for a new project |
| `gitflow-commit` | GitHub Flow + Conventional Commits workflow |
| `clarify` | Visualize complex content as diagrams, trees, or tables |
| `markdown` | Markdown syntax reference for writing documentation |
| `explain-code` | Explain code with analogies, diagrams, and gotchas |

## Structure

```
.claude/
├── agents/               # Custom agents (skill-reviewer, commit-validator, context-manager)
├── rules/                # Auto-loaded project rules
│   ├── constitution.md
│   ├── architecture.md
│   ├── context-management.md
│   └── skills.md
├── CLAUDE.md
└── settings.json
skills/                   # Installable skill definitions
.mcp.json                 # MCP server config (replace placeholder keys)
```

## MCP Servers

`.mcp.json` includes templates for: `context7`, `tavily`, `exa`, `browser-use`.
Replace placeholder API keys before use. See `skills/ctx-init/references/mcp-guide.md`.
