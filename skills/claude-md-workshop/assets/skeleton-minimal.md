# Stage-1 骨架：极简工具型 / 个人 dotfiles

> 模板。`{{...}}` 是占位符，生成时按 scaffold.md §4 的映射填空。保持 < 30 行。

```markdown
# {{project_summary}}

## Golden Rule

{{golden_rule}}

## NEVER

{{never_list}}

## 快速命令

```bash
{{commands}}
```

## 保护区

{{protected_paths}}

## Things That Will Bite You

{{bite_you}}

## 再次强调

{{never_list_short}}
```

## 填空规则

- `{{project_summary}}` — 例："Bun CLI · TypeScript · no framework"
- `{{golden_rule}}` — 默认 `When unsure about requirements, implementation, or scope, ASK before changing code.`
- `{{never_list}}` — Q2 答案，每条独立 `- NEVER ...` 行。用户没给就只放 `- NEVER push to main directly`。
- `{{commands}}` — 从 `package.json` scripts 抽 3-5 条（dev / test / build / lint / typecheck）
- `{{protected_paths}}` — Q3 答案，每条独立列表项。没给就整段删掉。
- `{{bite_you}}` — Q5 答案。没给就整段删掉。
- `{{never_list_short}}` — 从 `{{never_list}}` 里挑最容易被违反的 2-3 条重复。

## 产出示例（填空后）

```markdown
# claude-code-action · GitHub Action · TypeScript · Bun runtime

## Golden Rule

When unsure about requirements, implementation, or scope, ASK before changing code.

## NEVER

- NEVER commit secrets or `.env` files
- NEVER modify `action.yml` outputs without updating the step refs

## 快速命令

```bash
bun install
bun test
bun run build
```

## Things That Will Bite You

- Runtime is Bun, not Node — use `bun test` not `jest`
- Token revocation must be in an `always()` step (won't run if process crashes)

## 再次强调

- NEVER commit secrets
- NEVER modify `action.yml` outputs without updating step refs
```
