
# Constitution

## Core Principles
- **Library-first**: use mature third-party libraries; verify no existing equivalent
- **MVP-first**: implement only current requirements; no speculative abstractions
- **Test-driven**: tests before implementation, Red-Green-Refactor
- **Functional-first**: pure functions, immutable data; isolate side effects
- **Feature-based**: organize by business capability, not technical layer
- **Self-documenting**: semantic naming over comments (comment the *why*, not the *what*)

## Tooling & Workflow
- **Code Nav**: Prefer LSP (`goToDefinition`, `findReferences`) over text search
- **Text Search**: Reserve `rg`/`fd` exclusively for strings, comments, and configs
- **Refactoring**: ALWAYS `findReferences` before changing signatures
- **Information Retrieval**: `context7` (APIs) -> `Vercel Grep` (usage) -> `Exa` (trends/compare) -> `Brave Search` (fallback)
- **CLI & Env**: Use `gh` CLI (strictly NO `curl`); `sg` for AST; assume `zsh`

## Agent Behavior
- **When unsure, ASK**

## Things That Will Bite You
- **Stale Diagnostics**: DO NOT react to real-time LSP diagnostics during edits (false positives). Run `typecheck` (`tsc` or `oxlint`) post-batch for authoritative validation.

## 工作流

在解决问题之前，从 `gitflow-commit` 熟悉下git工作流，决定是否创建 git 分支。
注释、commit和内容以英文为主
