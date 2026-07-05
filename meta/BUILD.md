# 构建规则

`meta/` 存构建 skill / rule 的元指令；本文件是从元指令构建产物的规则。
产物品质由本文件决定：修改本文件前先与用户确认，不做顺手编辑。

元指令是源，永久保留；`skills/<name>/SKILL.md`、`docs/rules/<name>.md` 是构建产物，
可随时按新的风格标准重新构建——LLM 换代、最佳实践变化时，同一份元指令生成新产物。

## 元指令

- `skills/*.md` — skill 元指令，产物在仓库根 `skills/<name>/`
- `rules/*.md` — rule 元指令，产物在 `docs/rules/<name>.md`

```yaml
---
name: <产物名，与文件名一致>
target: skill | rule
status: stub | ready
---
```

- `stub` — 意图占位，内容待补全
- `ready` — 规格完整，可构建

正文写意图与要求：目标、约束、示例，可附内容素材。不写「已完成」之类的状态——
产物存在与否看目标位置，元指令没有终态。

## 触发

对 Claude 说「构建 `meta/skills/<name>.md`」或「构建 `meta/rules/<name>.md`」。

## 通用步骤

1. 读元指令；`status: stub` 先与用户对齐意图、补全成 `ready` 再继续
2. 按 `target` 执行对应规则（见下）
3. 产物一律落仓内约定位置；元指令里写了别的路径（如 `~/.claude/skills/`），以本文件为准修正
4. 跑 `make sync` 上账（`skills.json` 自动补 custom 条目）

## target: skill

产物：仓库根 `skills/<name>/SKILL.md`

- 先按 `templates/skill.md` 开头的检查步骤核实上游是否已有同类——
  有则在 `skills.json` 记 `official`，不自建
- 没有再用 `/skill-creator` 生成，遵循 skills.sh 标准和
  [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)

## target: rule

产物：`docs/rules/<name>.md`

- 创建前先过 `templates/rule.md` 的检查清单（该不该独立成文件、要不要 `paths` frontmatter）

## 回写纪律

- 意图变更：先改元指令，再重新构建产物
- 直接在产物上做了有价值的修改：必须回写元指令，否则下次重建丢失
