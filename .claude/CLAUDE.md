# CLAUDE.md

**infra-ai** — 个人 Claude Code 基础设施的中心源：skill、rule、模板、MCP 说明
在此集中维护，其他项目和设备从这里派生。源只在本仓改，下游副本不回改。

## 结构与模型

见 `.claude/rules/architecture.md`（自动加载）。一句话：`meta/` 元指令是源，
`skills/`、`rules/`、`templates/` 是构建产物，产物可重建、改动必须回写元指令。

## 命令

```bash
meta                      # TUI：对账、构建、分发、回写（pnpm link --global 后全局可用）
pnpm meta status          # 命令式（面向 AI/脚本）：完整命令面见 pnpm meta --help
```

## 新增资产

1. 在 `meta/<类>/` 建元指令（`stub` 起步，`ready` 可构建）
2. 构建：`pnpm meta build <name>`（或 `meta` 里选中按 `b`）——构建与分发规则见 `meta/build/<类>.md`
