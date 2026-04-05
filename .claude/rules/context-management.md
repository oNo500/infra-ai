# Context Management

Rules for managing Claude Code conversation context — keeping sessions focused, fast, and
free of accumulated noise.

---

## Core Principle

Context is a **workspace, not a log**. Stale tool results, abandoned search tangents, and
finished task state all degrade response quality. Actively manage it.

---

## When to `/clear`

Clear the context when:

- **Task boundary**: one logical unit of work is done, a new one is starting
- **Domain switch**: moving from debugging to writing new features (or vice versa)
- **Context overload**: more than ~25 tool calls have accumulated in the session
- **Confusion spiral**: back-and-forth corrections that have left Claude with a muddled model
  of what the code should look like
- **Before a PR**: always clear before a final review pass — fresh eyes catch more

Do NOT clear when:
- You're mid-task and the context is actively needed (file contents, error messages from this run)
- The next step builds directly on the current step's results

---

## When to Use a Subagent

Use the `Agent` tool instead of accumulating results in main context when:

- **Pure research**: web searches, doc reading — use a research subagent, get back a summary
- **Large codebase exploration**: scanning many files to answer a question — delegate to Explore agent
- **Parallel independent work**: multiple unrelated searches or analyses — run them concurrently
- **Protecting main context**: any operation that would dump >500 lines of output

Pattern: subagent does the expensive work, returns a tight summary, main context stays clean.

---

## Workflow Context Checkpoints

At each stage of the gitflow-commit workflow, apply these context rules:

| Stage | Action |
|-------|--------|
| **Starting a new feature branch** | `/clear` first — load fresh with CLAUDE.md |
| **Mid-feature, switching files** | No clear needed — context is still relevant |
| **Debugging a failing test** | Use subagent for isolated exploration if >3 files involved |
| **Before opening PR** | `/clear`, then re-read the diff — review with fresh context |
| **After PR merged, next task** | `/clear` unconditionally |

---

## CLAUDE.md + Rules as Context Anchors

The `.claude/rules/` system is designed so that clearing context is safe:

- `constitution.md` and `architecture.md` (no `paths` frontmatter) → always auto-loaded
- Path-specific rules (with `paths` frontmatter) → auto-loaded when relevant files are open
- `CLAUDE.md` → always loaded as the entry point

This means after `/clear`, Claude immediately has the project's core rules back without any
manual `@import`. Design rules files to be self-contained — no rule should depend on
something only established in the conversation.

---

## MEMORY.md for Cross-Session State

Use `~/.claude/projects/<project>/memory/` for state that must survive `/clear` and new sessions:

- Non-obvious decisions made ("we chose X over Y because Z")
- Active project context (deadlines, ongoing initiatives)
- User preferences discovered during work

Do NOT save to memory:
- File contents, code patterns (read the code instead)
- Task lists for the current session (use TaskCreate tools)
- Anything already in CLAUDE.md or rules files

---

## Signals That Context Needs Attention

- Responses start re-asking questions already answered earlier in the session
- Claude references a file edit that was later reverted
- Tool calls spike: >5 reads of the same file in one session
- Response latency increases noticeably (large context slows processing)

When you notice these: stop, `/clear`, reload only what's needed.
