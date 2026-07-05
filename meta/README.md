# meta

构建 skill / rule 的元指令。每个文件描述一个产物的意图与要求：目标、约束、示例。

元指令是源，永久保留；`skills/<name>/SKILL.md`、`docs/rules/<name>.md` 是构建产物，
可随时按新的风格标准重新构建——LLM 换代、最佳实践变化时，同一份元指令生成新产物。

## 目录

- `skills/*.md` — skill 元指令，产物在仓库根 `skills/<name>/`
- `rules/*.md` — rule 元指令，产物在 `docs/rules/<name>.md`

## 元指令格式

```yaml
---
name: <产物名，与文件名一致>
target: skill | rule
status: stub | ready
---
```

- `stub` — 意图占位，内容待补全
- `ready` — 规格完整，可构建

正文写意图与要求，可附内容素材。不写「已完成」之类的状态——产物存在与否看目标位置，
元指令没有终态。

## 构建

对 Claude 说「构建 `meta/skills/<name>.md`」：

1. 读元指令；`stub` 先与用户对齐、补全成 `ready` 再继续
2. skill → 先按 `templates/skill.md` 开头的检查步骤核实上游是否已有同类
   （有则在 `skills.json` 记 `official`，不自建）；没有再用 `/skill-creator`
   生成到 `skills/<name>/`，遵循 skills.sh 标准和
   [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
3. rule → `docs/rules/<name>.md`，创建前先过 `templates/rule.md` 的检查清单
4. 跑 `make sync` 上账（`skills.json` 自动补 custom 条目）

产物一律落仓内约定位置，元指令里写了别的路径（如 `~/.claude/skills/`）按本条修正。

## 回写纪律

- 意图变更：先改元指令，再重新构建产物
- 直接在产物上做了有价值的修改：必须回写元指令，否则下次重建丢失
