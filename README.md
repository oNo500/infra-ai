# infra-ai

个人 Claude Code 基础设施：skill、规则、MCP 说明、项目模板都在这里集中维护，
其他项目和设备从这里安装。改动只发生在本仓，下游不回改。

## 内容

- [`skills.json`](skills.json) — 全部 skill 的清单，`source` 字段区分来源：
  - `custom` — 自建，放在 `skills/<name>/`
  - `mirror` — 用 giget 从上游仓库拉取，放在 `skills/<name>/`，记录 commit
  - `official` — 符合 skills.sh 标准的上游 skill，只记 repo，不放进本仓

  清单记录的是目标态，允许比实际超前：`custom` 条目可能还没有对应目录。
  专题（SSoT、创建、维护、使用）见 [`SKILLS.md`](SKILLS.md)。
- [`docs/constitution/`](docs/constitution/) — constitution 与 architecture，供其他项目引用
- `rules/` — 可分发 rule 的构建产物：`global/`（无条件加载）+ `scoped/`（按 `paths` 动态加载）。暂空，随首个产物出现
- [`docs/mcp/`](docs/mcp/) — MCP server 说明
- [`templates/`](templates/) — 新项目模板（CLAUDE.md、settings.json 等）
- [`meta/`](meta/) — 构建 skill/rule 的元指令，永久保留、可重复构建；构建规则见各子目录的 `BUILD.md`

`docs/superpowers/` 是设计文档，`.claude/` 和 `.mcp.json` 是本仓自用配置，都不分发。

## 命令

```bash
make list    # 列出全部 skill 及来源
make check   # 检查 mirror 上游更新、核对 skills.json 清单（只读）
make sync    # 拉取有更新的 mirror、补齐清单（不 commit）
```

## 在其他项目/设备使用

```bash
# skill：仓内持有的（custom + mirror）
pnpx skills add oNo500/infra-ai -s <name>
pnpx skills add oNo500/infra-ai --all

# skill：official 类直接装上游
pnpx skills add <owner>/<repo> -s <name>

# 规则：手动复制到目标项目（不用 symlink，跨设备路径不可靠）
cp ~/code/infra-ai/rules/<类>/<topic>.md <project>/.claude/rules/<topic>.md

# 新项目脚手架
scripts/init-project.sh <target-dir> [--type ts-node|python|generic]
```

本仓 push 后，其他设备 `git pull` 再重新 copy 规则，skill 用 `pnpx skills update` 更新。
