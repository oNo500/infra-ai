# Architecture

## Project Structure

```
infra-ai/
├── .claude/
│   ├── CLAUDE.md              # project entry point
│   ├── settings.json          # permissions + env (project-scoped)
│   └── rules/                 # 本仓自用规则，不分发
│       ├── constitution.md    # rules/constitution.md 的分发副本
│       └── architecture.md    # this file
├── skills.json                # skill 账：存在与来源的 SSoT
├── profiles.json              # rule 组合账：项目 profile 显式清单
├── catalog.json               # 资产查询视图：iuse list/show/cat 的数据源
├── globals.json               # 全局层账：~/.claude 应装 rule 清单（iuse --global 只读对账）
├── SKILLS.md                  # skills 专题（SSoT、创建、维护、使用）
├── skills/                    # skill 产物（custom + mirror；official 留上游）
├── rules/                     # 可分发 rule 产物（纯正文无 frontmatter；scope 在开发仓，安装时渲染）
├── templates/                 # 项目模板（含占位符，分发时实例化）
│   └── template-instantiate.md   # AI 实例化契约（随 publish 落位）
├── docs/
│   ├── mcp/                   # MCP server 知识文档
│   └── superpowers/           # 设计文档存档（specs + plans）
└── .mcp.json                  # MCP 配置（自用，key 用占位符）
```

## 发布接收

- 本仓不产资产：skills/、rules/、templates/ 与四账（catalog/profiles/
  globals/skills）的内容一律来自开发仓 `~/code/meta` 的 `imeta publish`
- publish 落位语义：开发仓把 `status: synced` 的资产、四账与静态文件
  （含本文件对应的模板）复制到本仓工作区，不自动提交
- synced 门在开发仓：资产要先在开发仓构建、通过校验、达到 synced，
  才会被 publish 选中落位；本仓看到的永远是已过门的产物
- 本仓职责是人审：`git log --stat` / `git diff` 核对落位内容后提交；
  提交前不改资产内容，改动一律回开发仓重新 publish

## 对账

- 使用端口径，面向下游项目和设备：
  - `iuse status [--global]` — 逐 rule 对账下游副本与本仓 catalog 的
    漂移（synced/modified/outdated/missing/excluded/available）
  - `iuse diff [--rule <name>]` — 查看下游副本与本仓内容的具体差异
  - `iuse update` — 把本仓变更应用到已初始化的下游目标
- `--global` 对账 `~/.claude`（Claude 的 user scope）而非某个项目，
  与 target 互斥，只读
- 本仓自身状态用 `git status`／`git log --stat` 核对 publish 落位是否
  符合预期；资产层面的对账（stub/dirty/stale 等）属于开发仓 `imeta`
