# Fetch

Fetches URLs and converts content to Markdown. Enables Claude to read documentation
pages, API references, and any public URL without leaving the session.

**Activation: global** — no project-specific configuration needed.

## Install

```bash
claude mcp add fetch -- npx -y @anthropic-ai/mcp-fetch
```

## Usage

```
Fetch https://docs.example.com/api and summarize the auth section.
```

## Context cost

~2k tokens per fetch result (varies with page length). Use `WebFetch` permission
instead when the URL is known at prompt time — it's zero MCP overhead.
