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
- [`meta/`](meta/) — 构建 skill/rule/template 的元指令（`skills/`、`rules/`、`templates/`），永久保留、可重复构建；构建规则在 [`meta/build/`](meta/build/)，每类产物一份
- [`packages/meta-cli/`](packages/meta-cli/) — 维护端 CLI/TUI（bun + ink + citty）：对账、构建（claude headless）、分发、回写；动作注册表保证两种界面功能同步
- `artifacts.lock.json` — 构建登记（meta/产物 hash 基线，键 `<kind>:<name>`），由 meta-cli 维护

`docs/superpowers/` 是设计文档，`.claude/` 和 `.mcp.json` 是本仓自用配置，都不分发。

## 命令

```bash
imeta                     # TUI
imeta status [--json]     # 对账查询；有待收敛项时退出码为 1
imeta build <name>        # claude headless 构建；完整命令面 imeta --help
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

# 规则：手动复制（分发能力属使用端 CLI，待立项；不用 symlink，跨设备路径不可靠）
cp ~/code/infra-ai/rules/<类>/<topic>.md <project>/.claude/rules/<topic>.md

# 新项目脚手架
scripts/init-project.sh <target-dir> [--type ts-node|python|generic]
```

本仓 push 后，其他设备 `git pull` 再重新 copy 规则，skill 用 `pnpx skills update` 更新。
