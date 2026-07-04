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
   - skill → `skills/<name>/SKILL.md`，格式参照 `templates/skill.md`
   - rule → `docs/rules/<name>.md`，格式参照 `templates/rule.md`
3. 自建 skill 一律放仓内 `skills/`，不写 `~/.claude/skills/` 等仓库外路径；元指令里写了别的路径，按本条修正
4. 元指令 frontmatter `tags` 改 `done`
5. 跑 `make sync` 上账（`skills.json` 自动补 `{ "name": "<name>", "source": "custom" }`）

本机安装：`pnpx skills add oNo500/infra-ai -s <name>`。
