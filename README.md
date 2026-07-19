# infra-ai

个人 Claude Code 基础设施的**发布面**：其他项目和设备从这里安装 skill、
rule、模板。内容由开发仓 `~/code/meta` 构建验证后经 `imeta publish` 落位，
人审 diff 后提交——本仓不直接编辑资产，改动一律回开发仓。

## 内容

- [`skills.json`](skills.json) — 全部 skill 的清单，`source` 字段区分来源：
  - `custom` — 自建，放在 `skills/<name>/`
  - `mirror` — 用 giget 从上游仓库拉取，放在 `skills/<name>/`，记录 commit
  - `official` — 符合 skills.sh 标准的上游 skill，只记 repo，不放进本仓

  清单记录的是目标态，允许比实际超前。溯源分两层：`refUrl` 参考来源 +
  实际来源（repo 或 `install`）。专题见 [`SKILLS.md`](SKILLS.md)。
- [`catalog.json`](catalog.json) — 资产查询视图（描述/tags/profile 隶属），供 `iuse list/show` 消费
- [`globals.json`](globals.json) — 全局层账：`~/.claude`（Claude 的 user scope）应装的 rule 清单，`iuse status --global` 只读对账
- [`profiles.json`](profiles.json) — rule 组合账：项目 profile 显式清单
- [`rules/`](rules/) — 可分发 rule 产物：纯正文不含 frontmatter；`scope` 为管理元数据，`iuse` 安装时把 scoped 规则渲染上 `paths` frontmatter，global 规则原样落地（`iuse cat <name>` 输出安装形态）
- [`templates/`](templates/) — 新项目模板（CLAUDE.md、settings.json、architecture 等），分发时按目标项目实例化占位符
- [`docs/mcp/`](docs/mcp/) — MCP server 说明

维护端（元指令、构建契约、工具链源码）在开发仓 `~/code/meta`，不要在此
修改。`docs/superpowers/` 是设计文档存档，`.claude/` 与 `.mcp.json` 是
本仓自用配置，都不分发。

## 使用

```bash
# skill：仓内持有的（custom + mirror）
pnpx skills add oNo500/infra-ai -s <name>
pnpx skills add oNo500/infra-ai --all

# skill：official 类直接装上游
pnpx skills add <owner>/<repo> -s <name>

# 规则与模板：使用端 CLI（开发仓 ~/code/meta 的 packages/iuse 内 pnpm link --global）
iuse                                   # TTY 裸跑进 TUI：主菜单 → 浏览/初始化/对账/更新（交互式唯一入口）
iuse list [--tag a,b] [--grep <kw>]    # 查询资产：描述、tags、安装状态（已初始化目标附状态列）
iuse show <name>                       # 单条资产元数据 + 渲染后全文
iuse cat <name>                        # 输出渲染后的安装形态（可重定向落盘）
iuse profiles                          # 列出可选 profile 及其 rules
iuse init --profile <name> <project>   # 按预设组合初始化（--dry-run 预演；--exclude 排除个别）
iuse init --rules a,b,c <project>      # 不经 profile 直选拼装（查询完自选）
iuse status <project>                  # 下游对账：synced / modified / outdated / missing / available / excluded
iuse diff [--rule <name>] <project>    # 本地副本 vs 中心源差异
iuse update <project>                  # 拉中心源新版（本地被改的默认跳过，--force 覆盖）
iuse update --add x --remove y <project>   # 显式增装（含回补排除）/ 移除（删副本并记入排除）
iuse status|diff|list --global         # 全局层（~/.claude，即 Claude 的 user scope）只读对账，输出建议命令
# 子命令面 100% 命令式（AI/脚本稳定契约），全命令支持 --json
```

本仓收到 publish 提交并 push 后，其他设备 `git pull` 再 `iuse update`
各项目，skill 用 `pnpx skills update` 更新。
