# DBHub

数据库探索 MCP。让 Claude 无需离开会话即可读取 schema、执行只读查询、
理解数据结构。

**激活范围：项目级** —— 仅用于带数据库的项目。

## 安装

```bash
claude mcp add db -- npx -y @dbhub/mcp
```

## 配置 DSN

添加到 `.mcp.json`（替换为你的实际 DSN，切勿提交真实凭证）：

```json
{
  "mcpServers": {
    "db": {
      "command": "npx",
      "args": ["-y", "@dbhub/mcp"],
      "env": {
        "DATABASE_URL": "${DATABASE_URL}"
      }
    }
  }
}
```

真实的 `DATABASE_URL` 存放在 `.env.local`（已加入 gitignore），而不是 `.mcp.json` 中。

## 安全性

DBHub 默认强制只读访问。Claude 无法通过这个 server 执行 `INSERT`、`UPDATE`
或 `DELETE`。schema 迁移仍需通过显式的 Bash 命令，不能绕过这层限制。

## 上下文开销

约 8k token，加上 schema 描述（随表数量变化）。
