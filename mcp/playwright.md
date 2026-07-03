# Playwright MCP

Browser automation via Playwright. Enables Claude to navigate pages, fill forms,
click elements, and take screenshots — without writing test files.

**Activation: project-level** — only for projects that require browser interaction.

## Install

```bash
claude mcp add playwright -- npx -y @playwright/mcp@latest
```

## When to activate

- E2E testing workflows where Claude drives the browser
- Scraping or visual verification tasks
- Web app feature verification after implementation

## When NOT to activate

- API-only projects — adds ~12k tokens of unused tool descriptions
- Use `agent-browser` CLI instead for one-off browser tasks (zero MCP overhead)

## Context cost

~12k tokens. Only activate when the session will actually use the browser.
