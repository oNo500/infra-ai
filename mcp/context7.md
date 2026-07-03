# Context7

Fetches up-to-date library documentation directly from source. Eliminates hallucinated
API signatures from stale training data.

**Activation: global** — useful in every project that touches third-party libraries.

## Install

```bash
claude mcp add context7 -- npx -y @upstash/context7-mcp@latest
```

## Usage

Invoke via natural language: "use context7 to fetch the Prisma docs for `findMany`".
Context7 resolves the library, fetches current docs, and injects them into context.

## Context cost

~8k tokens per activation. Worth it any time you're working with a library whose
API may have changed since the model's training cutoff.
