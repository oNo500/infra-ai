# Stage-1 骨架：monorepo（根 + 子包双层）

> Monorepo 场景：根 CLAUDE.md 放跨包通用规则；每个实质子包用 path-scoped rules。

## 根 CLAUDE.md 模板（< 30 行）

```markdown
# {{project_summary}} — Monorepo Root

## Golden Rule

{{golden_rule}}

## NEVER（跨包通用）

{{never_list}}

## 快速命令（根级）

```bash
{{commands}}
```

## 包结构

{{workspace_tree}}

## 子包规则

各子包的详细规则在 `.claude/rules/<package>.md`（path-scoped，按需加载）。

## 再次强调

{{never_list_short}}
```

## 子包 rules 文件模板：`.claude/rules/<pkg-name>.md`

```markdown
---
paths:
  - apps/{{pkg_name}}/**
  - packages/{{pkg_name}}/**
---

# apps/{{pkg_name}} — Rules

## Golden Rule（子包）

When unsure about business logic or data shape, ASK before changing code.

## NEVER（子包特定）

{{pkg_never_list}}

## 架构约束

{{pkg_architecture}}

## Things That Will Bite You

{{pkg_bite_you}}
```

## 填空规则

**根级**：
- `{{workspace_tree}}` — 用 `ls apps/ packages/` 生成一棵 tree（≤ 10 行）
- 其他见 `skeleton-minimal.md`

**子包级**：
- `{{pkg_name}}` — 子包目录名（`apps/api-web` → `api-web`）
- `{{pkg_never_list}}` — 子包专属 NEVER（和根的不重复）
- `{{pkg_architecture}}` — 一行架构原则（参考 skeleton-app.md）

## 多子包处理顺序

生成时：
1. 先写根 CLAUDE.md
2. 扫 `apps/` 和 `packages/`，忽略纯配置包（`config-*` / `tsconfig*` / `eslint-config*`）
3. 对每个实质子包生成 `.claude/rules/<pkg>.md`
4. 交付清单列出所有生成的文件
