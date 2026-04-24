# Stage-1 骨架：AGENTS.md + CLAUDE.md 双文件

> 双文件模式：`AGENTS.md` 装通用规则（所有 AI 工具都读），`CLAUDE.md` 首行 `@AGENTS.md` 然后只补 Claude 特有内容。来源：`ai-practice-CLAUDEmd示例注解.md` 判断 4。

## AGENTS.md 模板

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

## 架构约束

{{architecture_principle}}

## 保护区

{{protected_paths}}

## Things That Will Bite You

{{bite_you}}

## 再次强调

{{never_list_short}}
```

## CLAUDE.md 模板（首行 import AGENTS.md）

```markdown
@AGENTS.md

## Claude 特有补充

<!-- 本段只放 Claude Code 特有行为。如果没有，整段可以删。 -->

- Slash commands preferences: <...>
- Skill preferences: <...>
```

## 填空规则

- AGENTS.md 的占位符规则和 `skeleton-app.md` 一致
- CLAUDE.md 的 `## Claude 特有补充` 段默认为空。除非用户在 Q1 之后明确说"我要让 Claude 特定走 xxx"，否则整段连标题删掉，只留 `@AGENTS.md` 一行。

## 产出文件

- `./AGENTS.md` — 主文件
- `./CLAUDE.md` — 一行 `@AGENTS.md`（最小化）

## 其他工具的覆盖（可选提示给用户）

如果项目也用 Cursor / Cody / aider 等工具：
- Cursor 读 `.cursor/rules/*.mdc`（和 AGENTS.md 并行维护一份，或 symlink）
- aider 默认读 `CONVENTIONS.md`（可做个 symlink 指向 AGENTS.md）
