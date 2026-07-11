# CLAUDE.md

**infra-ai** — 个人 Claude Code 基础设施的中心源：skill、rule、模板、MCP 说明
在此集中维护，其他项目和设备从这里派生。源只在本仓改，下游副本不回改。

## 结构与模型

见 `.claude/rules/architecture.md`（自动加载）。一句话：`meta/` 元指令是源，
`skills/`、`rules/`、`templates/` 是构建产物，产物可重建、改动必须回写元指令。

## 命令

```bash
make meta        # 打开 meta-cli TUI：对账、构建、分发、回写
```

TUI 内：`b` 构建、`w` 回写、`d` 分发、`t` targets 管理、`s` skills 对账（含已安装清单与推荐）。

## 新增资产

1. 在 `meta/<类>/` 建元指令（`stub` 起步，`ready` 可构建）
2. 打开 `make meta`，选中该资产按 `b` 构建——构建与分发规则见 `meta/build/<类>.md`
