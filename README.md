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

---

## Claude Code Best Practices

> Source: [Claude Code Docs — Best Practices](https://code.claude.com/docs/en/best-practices)

The single most important constraint: **context window fills up fast, and performance degrades as it fills.** Everything below is about managing this.

### Give Claude a Way to Verify Its Work

Provide tests, screenshots, or expected outputs so Claude can check itself — this is the highest-leverage thing you can do.

- For code: write failing tests first, ask Claude to make them pass
- For UI: paste a screenshot, ask Claude to compare its output and fix differences
- For builds: paste the error, ask Claude to fix the root cause and verify the build passes

### Explore First, Then Plan, Then Code

Use Plan Mode (`Shift+Tab` to toggle) to separate research from execution:

1. **Explore** — Claude reads files without making changes
2. **Plan** — ask for a detailed implementation plan, edit it with `Ctrl+G`
3. **Implement** — switch to Normal Mode, let Claude code against the plan
4. **Commit** — ask Claude to commit and open a PR

Skip the plan for small, obvious changes (typo fix, rename, single-line change).

### Provide Specific Context

- Reference files with `@filename` instead of describing where things are
- Paste images directly into the prompt for UI tasks
- Point to existing patterns: *"follow the pattern in HotDogWidget.php"*
- Describe symptoms with location: *"login fails after session timeout, check src/auth/"*

### Write an Effective CLAUDE.md

Keep it short. For each line ask: *"Would removing this cause Claude to make mistakes?"* If not, cut it. Bloated CLAUDE.md files cause Claude to ignore instructions.

| Include | Exclude |
|---------|---------|
| Bash commands Claude can't guess | Anything Claude can infer from reading code |
| Code style rules that differ from defaults | Standard conventions Claude already knows |
| Testing instructions and preferred runners | Detailed API docs (link instead) |
| Repo etiquette (branch naming, PR conventions) | File-by-file codebase descriptions |
| Architectural decisions specific to the project | Self-evident practices like "write clean code" |

### Manage Context Aggressively

- Use `/clear` at task boundaries — CLAUDE.md + rules reload automatically
- Use subagents (Agent tool) for research-heavy work to protect main context
- Watch for signs of context bloat: Claude re-asks answered questions, references reverted edits
- Track context usage with a [custom status line](https://code.claude.com/docs/en/statusline)

### Course-Correct Early and Often

Don't let Claude go far in the wrong direction. If the approach looks off after 2–3 steps, stop and redirect. It's cheaper to course-correct early than to untangle a long wrong path.

### Use Subagents for Investigation

Delegate exploration to subagents instead of accumulating results in main context:
- Large codebase scans
- Web research and doc reading
- Parallel independent tasks

### Use CLI Tools

Install `gh`, `aws`, `gcloud`, and other CLI tools — they're the most context-efficient way to interact with external services. Claude knows how to use them and can learn new ones with `--help`.
