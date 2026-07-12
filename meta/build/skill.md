# skill 构建规则

`meta/skills/*.md` 是 skill 元指令；本文件是从元指令构建 skill 的规则。
产物品质由本文件决定：修改前先与用户确认，不做顺手编辑。

元指令是源，永久保留；`skills/<name>/SKILL.md` 是构建产物，可随时按新的风格标准
重新构建——LLM 换代、最佳实践变化时，同一份元指令生成新产物。

## 元指令格式

```yaml
---
name: <产物名，与文件名一致>
target: skill
status: stub | ready
---
```

- `stub` — 意图占位，内容待补全
- `ready` — 规格完整，可构建

正文写意图与要求：目标、约束、示例，可附内容素材。元指令没有终态，
产物存在与否看目标位置。

## 构建

触发：`imeta` 选中资产按 `b`（headless 构建），或对 Claude 说「构建 `meta/skills/<name>.md`」。

1. 读元指令；`status: stub` 先与用户对齐意图、补全成 `ready` 再继续
2. 先按 `templates/skill.md` 开头的检查步骤核实上游是否已有同类——
   有则在 `skills.json` 记 `official`，不自建；headless 构建沙箱为此放行了
   `WebFetch(domain:ungh.cc)`（免认证列目录），无 Bash
3. 没有再用 `/skill-creator` 生成到仓库根 `skills/<name>/`，遵循 skills.sh 标准和
   [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
4. 产物一律落仓内；元指令里写了别的路径（如 `~/.claude/skills/`），以本文件为准修正
5. 语言：正文以中文为主，术语、type 名、命令、代码与标识保留英文；
   frontmatter（`name`/`description`）保持英文（skills.sh 生态与触发匹配）
6. 在 `imeta` 的 `s` 视图按 `f` 上账（`skills.json` 自动补 custom 条目）

## 回写纪律

- 意图变更：先改元指令，再重新构建产物
- 直接在产物上做了有价值的修改：必须回写元指令，否则下次重建丢失
