# GitHub MCP

Official GitHub MCP server. Gives Claude access to repos, issues, PRs, and code search
without rate-limit workarounds.

**Activation: project-level** — add to `.claude/settings.json` per project that needs it.

## Install

```bash
claude mcp add github -- npx -y @modelcontextprotocol/server-github
# Set token:
export GITHUB_PERSONAL_ACCESS_TOKEN=<your-token>
```

## Toolset scoping

Do not activate all tools — it adds ~15k tokens of tool descriptions. Restrict to what
the project actually uses via `toolsets` in `.mcp.json`:

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

Available toolsets: `repos`, `issues`, `pull_requests`, `code_search`, `users`,
`notifications`, `actions`, `packages`, `orgs`, `security`.

## Context cost

~10k tokens with scoped toolset; ~15k+ if unrestricted.
