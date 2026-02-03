---
name: creating-skills
description: Provides templates and guidelines for creating new Skills. Use this skill as a starting point when creating a new skill or when asking about skill structure and best practices.
---

# Skill Template

A template for creating well-structured Skills that follow Anthropic's best practices.

## Skill Structure

```
skill-name/
├── SKILL.md          # Main entry file (required)
├── rules/            # Rule files directory (optional)
│   └── *.md          # Individual rule files
├── reference/        # Reference docs directory (optional)
│   └── *.md          # Detailed documentation
└── metadata.json     # Metadata file (optional)
```

## Frontmatter Requirements

SKILL.md must include YAML frontmatter with exactly two fields:

```yaml
---
name: skill-name
description: Third-person description of what the skill does and when to use it.
---
```

**name**:
- Max 64 characters
- Lowercase letters, numbers, and hyphens only
- Use gerund form (verb + -ing): `explaining-code`, `optimizing-react`

**description**:
- Max 1024 characters
- Always third-person: "Provides...", "Explains...", "Helps..."
- Include trigger conditions: "Use when..."

## Progressive Disclosure

Keep SKILL.md under 500 lines. For detailed content:

```markdown
## Quick Reference
[Brief overview in SKILL.md]

## Detailed Rules
See individual rule files:
- `rules/category-rule.md`
- `rules/category-another.md`
```

Claude reads SKILL.md first, then loads specific files as needed.

## Rule File Template

```markdown
---
title: Rule Title
impact: CRITICAL/HIGH/MEDIUM/LOW
tags: tag1, tag2
---

## Rule Title

Brief explanation.

**Incorrect:**
\`\`\`typescript
// Bad example
\`\`\`

**Correct:**
\`\`\`typescript
// Good example
\`\`\`
```
