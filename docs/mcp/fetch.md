# Fetch

抓取 URL 并将内容转换为 Markdown。让 Claude 无需离开会话即可阅读文档页面、
API 参考资料以及任何公开 URL。

**激活范围：全局** —— 无需项目级配置。

## 安装

```bash
claude mcp add fetch -- npx -y @anthropic-ai/mcp-fetch
```

## 用法

```
Fetch https://docs.example.com/api and summarize the auth section.
```

## 上下文开销

每次抓取结果约 2k token（随页面长度变化）。当提示词写作时就已知道具体 URL 时，
改用 `WebFetch` 权限即可 —— 零 MCP 开销。
