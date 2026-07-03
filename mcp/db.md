# DBHub

Database exploration MCP. Enables Claude to read schema, run read-only queries,
and understand data shape without leaving the session.

**Activation: project-level** — only for projects with a database.

## Install

```bash
claude mcp add db -- npx -y @dbhub/mcp
```

## Configure DSN

Add to `.mcp.json` (replace with your actual DSN, never commit real credentials):

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

Store the real `DATABASE_URL` in `.env.local` (gitignored), not in `.mcp.json`.

## Safety

DBHub enforces read-only access by default. Claude cannot run `INSERT`, `UPDATE`,
or `DELETE` through this server. Schema migrations still require explicit Bash commands.

## Context cost

~8k tokens plus schema description (varies with table count).
