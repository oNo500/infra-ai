# creator

待创建 skill / rule 的元指令。每个文件描述一个要生成的资产；由 Claude 按下面的流程执行，无脚本机制。本目录自用，不分发。

## 目录

- `skills/*.md` — 要创建的 skill
- `rules/*.md` — 要创建的 rule

## 元指令状态

frontmatter `tags` 标记：

- `stub` — 只有意图，内容待定
- `draft` — 内容完整，可执行
- `done` — 已执行，文件原地保留

## 执行流程

对 Claude 说「执行 `creator/skills/<name>.md`」：

1. 读元指令；`stub` 先与用户对齐内容、补全成 `draft` 再继续
2. 生成产物：
   - skill → 先按 `templates/skill.md` 开头的检查步骤核实上游是否已有同类（官方插件或 skills.sh 收录），
     命中则在 `skills.json` 记 `official`，不自建；未命中用 `/skill-creator` 创建到 `skills/<name>/`，
     遵循 skills.sh 标准和 [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
   - rule → `docs/rules/<name>.md`，创建前先过 `templates/rule.md` 的检查清单
3. 自建 skill 一律放仓内 `skills/`，不写 `~/.claude/skills/` 等仓库外路径；元指令里写了别的路径，按本条修正
4. 元指令 frontmatter `tags` 改 `done`
5. 跑 `make sync` 上账（`skills.json` 自动补 `{ "name": "<name>", "source": "custom" }`）

本机安装：`pnpx skills add oNo500/infra-ai -s <name>`。
