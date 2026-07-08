# CLAUDE.md

**infra-ai** — 个人 Claude Code 基础设施的中心源：skill、rule、模板、MCP 说明
在此集中维护，其他项目和设备从这里派生。源只在本仓改，下游副本不回改。

## 结构与模型

见 `.claude/rules/architecture.md`（自动加载）。一句话：`meta/` 元指令是源，
`skills/`、`rules/`、`templates/` 是构建产物，产物可重建、改动必须回写元指令。

## 命令

```bash
make list        # skill 清单及来源
make check       # mirror 上游与 skills.json 对账（只读）
make sync        # 拉取 mirror 更新、补齐清单（不 commit）
make list-rules  # rule 元指令与产物对账
```

## 新增资产

1. 在 `meta/<类>/` 建元指令（`stub` 起步，`ready` 可构建）
2. 对 Claude 说「构建 `meta/<类>/<name>.md`」——构建与分发规则见 `meta/build/<类>.md`
