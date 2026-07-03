---
paths:
  - "**/*"
---

# Hooks Policy

Hooks are enforced by the Claude Code process, not the model. Use hooks for behaviors that
must happen deterministically — not suggestions Claude can skip under context pressure.

## Must Have Hook (non-negotiable)

These behaviors MUST be implemented as hooks, never as CLAUDE.md instructions:

**PostToolUse — auto-format on write**
Trigger: any Write/Edit/MultiEdit to `.ts`, `.tsx`, `.js`, `.jsx`, `.py` files.
Why: formatting as a CLAUDE.md rule has ~44% skip rate under context pressure (Vercel data).

**PreCompact — inject critical rules into compaction prompt**
Trigger: every compaction (manual or auto).
Why: CLAUDE.md reloads after compaction, but rules written mid-session don't survive without
explicit injection. Use `COMPACT_RULES.md` with directive-format content, not prose.

**Stop — desktop notification on session end**
Trigger: every session stop.
Why: async awareness; avoids polling the terminal.

## Should Have Hook (project-dependent)

**PreToolUse — inject package-level rules in monorepos**
Trigger: Read/Edit/Write where file path contains a known package prefix.
When: monorepos with per-package RULES.md files.
Skip: single-package repos where one CLAUDE.md covers everything.

## Must Not Use Hook For

- Style preferences already enforced by linters (double-enforcement creates noise)
- Behaviors that only apply sometimes — use Skill + good description instead
- Blocking operations that require network calls (PreToolUse blocks the tool call synchronously)

## exit code contract

- exit 0: pass, stdout JSON is parsed for additionalContext
- exit 2: block tool call, stderr is shown to Claude as error (PreToolUse only)
- other non-zero: non-blocking warning

stdout must be pure JSON or empty. Shell profile output (from ~/.zshrc) causes silent JSON
parse failure — use `"args": ["python3", "script.py"]` form to avoid sourcing the profile.
