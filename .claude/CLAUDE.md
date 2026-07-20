# CLAUDE.md

**infra-ai** — 个人 Claude Code 基础设施的发布面：skill、rule、模板的
产物与账由开发仓（`~/code/infra-agent/meta`）经 `imeta publish` 落位，
本仓人审 diff 后提交。下游项目和设备从这里安装。

## 职责边界

- 本仓不直接编辑资产：rules/、skills/、templates/、schema/ 与三账
  （catalog/profiles/skills）的改动一律回开发仓，publish 会
  覆盖此处的直接修改
- 本仓自有内容：tools/（使用端 CLI，pnpm workspace）、docs/mcp/
  （MCP 说明）、docs/superpowers/（设计文档存档）、.claude/ 与
  .mcp.json（自用配置）、README/SKILLS 使用文档

## 结构

pnpm monorepo：根 `pnpm-workspace.yaml` 收 `tools/*`。
`tools/iuse` 是使用端 CLI（bin: iuse），契约类型由包内 `pnpm codegen`
从根 `schema/` 生成，加载数据时用同一批 schema 做 ajv 运行时校验。

## 常用命令

```bash
iuse list|show|cat        # 查询资产（数据源 catalog.json）
iuse init --profile <p> <dir>   # 向目标项目拼装；status/update 对账更新
git log --stat            # 人审 publish 落位的变更后提交
pnpm -r test              # tools 下各包测试（改 tools/ 后跑）
```

维护端命令（imeta build/publish 等）在开发仓使用。schema 变更的 SSoT
在开发仓 `packages/meta-cli/schema/`，随 publish 同步到本仓 `schema/`。

全局 `iuse` 命令：pnpm 对多个 link --global 包会互清 binstub，本仓用
直接符号链接（`ln -sf $PWD/tools/iuse/src/index.ts ~/.pnpm-global/bin/iuse`）。
