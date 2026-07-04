# GitHub MCP

官方 GitHub MCP server。让 Claude 无需绕过速率限制即可访问仓库、issue、PR 和代码搜索。

**激活范围：项目级** —— 按需在有需要的项目里加入 `.claude/settings.json`。

## 安装

```bash
claude mcp add github -- npx -y @modelcontextprotocol/server-github
# 设置 token：
export GITHUB_PERSONAL_ACCESS_TOKEN=<your-token>
```

## 工具集范围限定

不要激活全部工具 —— 那会增加约 15k token 的工具描述开销。通过 `.mcp.json` 里的
`toolsets` 限制到项目实际用到的部分：

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PERSONAL_ACCESS_TOKEN}" },
      "toolsets": ["repos", "issues", "pull_requests", "code_search"]
    }
  }
}
```

可用的工具集：`repos`、`issues`、`pull_requests`、`code_search`、`users`、
`notifications`、`actions`、`packages`、`orgs`、`security`。

## 上下文开销

限定工具集后约 10k token；不限制则 15k+。
