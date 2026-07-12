# Architecture

## Project Structure

```
infra-ai/
├── .claude/
│   ├── CLAUDE.md              # project entry point
│   ├── settings.json          # permissions + env (project-scoped)
│   └── rules/                 # 本仓自用规则，不分发
│       ├── constitution.md    # rules/global/constitution.md 的分发副本
│       └── architecture.md    # this file
├── skills.json                # skill 账：存在与来源的 SSoT
├── SKILLS.md                  # skills 专题（SSoT、创建、维护、使用）
├── skills/                    # skill 产物（custom + mirror；official 留上游）
├── meta/                      # 元指令源，永久保留
│   ├── build/                 # 构建规则，每类产物一份（rule.md、skill.md、template.md）
│   ├── rules/                 # rule 元指令
│   ├── skills/                # skill 元指令
│   └── templates/             # template 元指令
├── rules/                     # 可分发 rule 产物
│   ├── global/                # 无 paths frontmatter，无条件加载，copy 即用
│   └── scoped/                # paths frontmatter，按 glob 触发加载
├── templates/                 # 项目模板（含占位符，分发时实例化）
├── docs/
│   ├── mcp/                   # MCP server 知识文档
│   └── superpowers/           # 设计文档（specs + plans）
├── packages/meta-cli/         # 维护端 CLI/TUI（对账/构建/回写；bin: imeta）
├── scripts/                   # init-project.sh（使用端脚手架，待迁往使用端 CLI）
├── artifacts.lock.json        # 构建登记：meta/产物 hash 基线（键 <kind>:<name>）
└── .mcp.json                  # MCP 配置（自用，key 用占位符）
```

## 源→产物模型

- `meta/` 元指令是源，永久保留；`skills/`、`rules/`、`templates/` 下的构建产物可重建
- 构建与分发规则在 `meta/build/`，每类产物一份
- 产物上的有价值修改必须回写元指令，否则下次重建丢失

## 分发

- `rules/global|scoped/` — 照搬型，手动 copy 到目标项目 `.claude/rules/`（分发能力属使用端 CLI，待立项）
- `templates/` — 模板型，结合目标项目实例化占位符后落地
- 源只在本仓改，下游副本不回改

## 对账

- `imeta` 打开 TUI（全局命令：`packages/meta-cli` 内 `pnpm link --global`；未 link 用 `pnpm meta`）：
  资产状态（stub/unbuilt/untracked/dirty/stale/synced）、
  skills ledger 与 mirror 上游，均在界面内收敛
- 非交互：`imeta status [--json]` 等子命令，退出码语义化
- mutation 动作运行留痕 `.imeta/logs/*.jsonl`（git-ignored，留最近 50 次，
  含 claude 原始事件流）；失败输出附 `log: <path>` 指向现场

## 动作注册表（功能同步红线）

- `packages/meta-cli/src/core/actions.ts` 是全部维护动作的 SSoT：
  CLI 子命令由它生成，TUI 键位在 `src/tui/keymap.ts` 声明
- 新增动作必须先进注册表，再接 keymap；`tests/parity.test.ts` 不过不得提交
