# MCP 配置指南

## 概要

MCP (Model Context Protocol) servers 扩展 Claude Code 的工具能力。配置文件为项目根级 `.mcp.json`，
格式与 `~/.claude.json` 中的 `mcpServers` 字段相同。

项目级 `.mcp.json` 优先于用户级配置，适合在团队间共享工具集。

---

## 核心 MCP Servers

### context7 — 第三方库文档查询

**用途**：查询任何库/框架的最新 API 文档，避免训练数据过时的问题。
**触发**：涉及第三方库的具体 API、参数、版本差异时**必须**先调用。

```json
{
  "context7": {
    "command": "npx",
    "args": ["-y", "@upstash/context7-mcp@latest"]
  }
}
```

> 无需 API Key，免费使用。

---

### tavily — LLM 优化搜索

**用途**：通用 web 搜索，返回适合 LLM 消费的结构化结果。
**触发**：需要搜索技术方案、文档、最新资讯时。

```json
{
  "tavily": {
    "type": "http",
    "url": "https://mcp.tavily.com/mcp/?tavilyApiKey=YOUR_KEY"
  }
}
```

> 获取 Key：https://tavily.com — 设置到 `env.TAVILY_API_KEY` 或直接写入 URL。

---

### exa — 语义搜索 + 代码案例

**用途**：语义搜索，擅长找真实项目中的代码用法、技术博客对比分析。
**触发**：需要看真实项目如何组合使用 API，或对比不同方案优劣时。

```json
{
  "exa": {
    "type": "http",
    "url": "https://mcp.exa.ai/mcp?exaApiKey=YOUR_KEY"
  }
}
```

> 获取 Key：https://exa.ai

---

### browser-use — 浏览器自动化

**用途**：控制浏览器进行页面交互、表单填写、截图、数据提取。
**触发**：需要与网页交互、测试 Web UI、抓取动态内容时。

```json
{
  "browser-use": {
    "command": "npx",
    "args": [
      "mcp-remote",
      "https://api.browser-use.com/mcp",
      "--header",
      "X-Browser-Use-API-Key: YOUR_KEY"
    ]
  }
}
```

> 获取 Key：https://browser-use.com

---

## 检索策略（四级）

按优先级从高到低：

| 优先级 | 工具 | 场景 |
|--------|------|------|
| 1 | **context7** | 第三方库 API、参数、版本差异 |
| 2 | **exa** | 真实项目代码用法、方案对比 |
| 3 | **tavily** | 通用技术搜索、最新资讯 |
| 4 | Brave Search (env) | 兜底，以上都找不到时 |

---

## API Key 管理

**不要把真实 Key 写进 `.mcp.json` 提交到 git。**

两种安全方式：

**方式 1**：通过 `settings.json` env 注入，`.mcp.json` 读取环境变量：
```json
// settings.json
{ "env": { "TAVILY_API_KEY": "tvly-xxx" } }

// .mcp.json URL 中用 $(TAVILY_API_KEY) 或在 args 中用 env 引用
```

**方式 2**：`.mcp.json` 加入 `.gitignore`，每人本地维护各自的 key。

> 本项目 `.mcp.json` 中的 key 占位符（如 `TAVILY_API_KEY`）需替换为真实值后才能使用。
