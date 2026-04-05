---
paths:
  - skills/**
---

# skills - Architecture

## Structure

Each skill is a directory under `skills/` with:

```
skills/{name}/
├── SKILL.md        # entry point: frontmatter (name, description) + workflow
├── assets/         # template files Claude fills in during skill execution
└── references/     # guides explaining how to fill the templates
```

## Conventions

- `SKILL.md` frontmatter must have `name` (matches dir name) and `description`
- `description` must be specific enough for Claude to auto-invoke without ambiguity — include trigger phrases and examples
- `assets/` files may contain `[ALL_CAPS]` placeholders; these are filled at skill execution time, never committed unfilled to a real project
- `references/` files are prose guides, not templates
- After writing or modifying a SKILL.md, run the `skill-reviewer` agent to validate
