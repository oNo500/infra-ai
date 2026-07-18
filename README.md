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
- [`rules/`](rules/) — 可分发 rule 的构建产物：`global/`（无条件加载，含 constitution）+ `scoped/`（按 `paths` 动态加载）
- [`docs/mcp/`](docs/mcp/) — MCP server 说明
- [`templates/`](templates/) — 新项目模板（CLAUDE.md、settings.json、architecture 等），分发时按目标项目实例化占位符
- [`meta/`](meta/) — 构建 skill/rule/template 的元指令（`skills/`、`rules/`、`templates/`），永久保留、可重复构建；AI 构建契约在 [`meta/prompts/`](meta/prompts/)，每类两份（build/writeback）
- [`packages/meta-cli/`](packages/meta-cli/) — 维护端 CLI/TUI（bun + ink + citty）：对账、构建（claude headless）、回写；动作注册表保证两种界面功能同步
- [`packages/preview/`](packages/preview/) — 产物 web 预览（元指令|产物对照，imeta preview / TUI v 拉起，端口 4412）
- `artifacts.lock.json` — 构建登记（meta/产物 hash 基线，键 `<kind>:<name>`），由 meta-cli 维护

`docs/superpowers/` 是设计文档，`.claude/` 和 `.mcp.json` 是本仓自用配置，都不分发。

## 命令

```bash
imeta                     # TUI
imeta status [--json]     # 对账查询；有待收敛项时退出码为 1
imeta build <name>        # claude headless 构建；完整命令面 imeta --help
imeta preview [name]      # web 预览：元指令与产物对照（自动启动本地 server，常驻 4412）
                          # 停止：pkill -f 'preview.*server.ts'（日志 .imeta/preview-server.log）
```

全局 `imeta` 命令来自 `packages/meta-cli` 内执行一次 `pnpm link --global`；
未 link 时在仓库根用 `pnpm meta <...>` 等价调用。

## 在其他项目/设备使用

```bash
# skill：仓内持有的（custom + mirror）
pnpx skills add oNo500/infra-ai -s <name>
pnpx skills add oNo500/infra-ai --all

# skill：official 类直接装上游
pnpx skills add <owner>/<repo> -s <name>

# 规则与模板：使用端 CLI 按 profile 拼装（packages/iuse 内 pnpm link --global）
iuse                                   # TTY 裸跑进 TUI（选 profile → 预演 → 执行 / 对账更新）
iuse profiles                          # 列出可选 profile 及其 rules
iuse init --profile <name> --dry-run <project>   # 预演拼装计划，零写入（远程源拉快照到缓存属读侧）
iuse init --profile <name> <project>   # 新项目初始化（rules + settings + CLAUDE.md/architecture 实例化）
iuse status <project>                  # 下游对账：synced / modified / outdated / excluded
iuse diff [--rule <name>] <project>    # 本地副本 vs 中心源差异（裸跑不含 excluded）
iuse update <project>                  # 拉中心源新版（本地被改的默认跳过，--force 覆盖）
# init --exclude / update --include 管理目标级排除；全命令支持 --json（AI/脚本消费）
```

本仓 push 后，其他设备 `git pull` 再 `iuse update` 各项目，skill 用 `pnpx skills update` 更新。
