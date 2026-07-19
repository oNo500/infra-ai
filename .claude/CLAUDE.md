# CLAUDE.md

**infra-ai** — 个人 Claude Code 基础设施的中心源：skill、rule、模板、MCP 说明
在此集中维护，其他项目和设备从这里派生。源只在本仓改，下游副本不回改。

## 结构与模型

见 `.claude/rules/architecture.md`（自动加载）。一句话：`meta/` 元指令是源，
`skills/`、`rules/`、`templates/` 是构建产物，产物可重建、改动必须回写元指令。

## 命令

```bash
imeta                     # TUI：对账、构建、回写
imeta status              # 命令式（面向 AI/脚本）：完整命令面见 imeta --help
imeta preview [name]      # web 预览：元指令与产物对照（自动启动本地 server，常驻 4412）
                          # 停止：pkill -f 'preview.*server.ts'（日志 .imeta/preview-server.log）
iuse list|show            # 使用端查询：资产描述/tags/状态（数据源 catalog.json）
iuse init --profile <p> <dir>   # 使用端：拼装（--rules 直选亦可；status/update 对账与更新，--global 对账全局层）
```

全局命令来自各包内 `pnpm link --global`（meta-cli → imeta，iuse → iuse）；未 link 用 `pnpm meta <...>`。

## 新增资产

1. 在 `meta/<类>/` 建元指令（`stub` 起步，`ready` 可构建）
2. 构建：`imeta build <name>`（或 `imeta` TUI 里选中按 `b`）——AI 构建契约见 `meta/prompts/`，格式说明见 `meta/README.md`

用户给官方链接要求引入资产时，按 `meta/prompts/asset-intake.md` 契约执行
（真实抓取、判类落账、refUrl+实际来源两层溯源、人审）。
