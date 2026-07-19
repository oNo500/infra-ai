# CLAUDE.md

**infra-ai** — 个人 Claude Code 基础设施的发布面：skill、rule、模板的
产物与账由开发仓 `~/code/meta` 经 `imeta publish` 落位，本仓人审 diff
后提交。下游项目和设备从这里安装。

## 职责边界

- 本仓不直接编辑资产：rules/、skills/、templates/ 与四账
  （catalog/profiles/globals/skills）的改动一律回开发仓，publish 会
  覆盖此处的直接修改
- 本仓自有内容仅：docs/mcp/（MCP 说明）、docs/superpowers/（设计文档
  存档）、.claude/ 与 .mcp.json（自用配置）、README/SKILLS 使用文档

## 常用命令

```bash
iuse list|show|cat        # 查询资产（数据源 catalog.json）
iuse init --profile <p> <dir>   # 向目标项目拼装；status/update 对账更新
git log --stat            # 人审 publish 落位的变更后提交
```

维护端命令（imeta build/publish 等）在开发仓 `~/code/meta` 使用。
