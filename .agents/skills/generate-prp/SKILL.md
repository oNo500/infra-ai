---
name: generate-prp
description: >
  PRP workflow step 1: convert a feature request into an implementation blueprint.
  Trigger when the user provides an INITIAL.md file and asks to generate a PRP,
  plan an implementation, or create a feature blueprint.
  Trigger phrases: "generate PRP", "create PRP", "plan this feature", "/generate-prp".
disable-model-invocation: true
---

# Generate PRP

Convert `INITIAL.md` into a detailed implementation blueprint at `PRPs/<feature>.md`.

The purpose of this separation: the exploration context (reading docs, finding patterns,
understanding the codebase) must not pollute the implementation context. Generate here,
implement in a fresh session with `/execute-prp`.

## Step 1 — Read the request

Read `INITIAL.md`. It uses this structure:

```
## FEATURE
What to build, in plain language.

## EXAMPLES
Reference implementations or patterns the user wants to follow.

## DOCUMENTATION
Relevant docs, API references, or constraints.

## OTHER CONSIDERATIONS
Edge cases, known gotchas, or constraints not covered above.
```

If `INITIAL.md` does not exist, ask the user to create it before continuing.

## Step 2 — Research the codebase

Before writing the blueprint, read the relevant code:

- Find similar features already in the codebase (`rg` for keywords, `find` for file patterns)
- Identify which files will need to change
- Note any patterns the implementation must follow (naming, error handling, test structure)

## Step 3 — Write the blueprint

Create `PRPs/<feature-name>.md` with:

```markdown
# PRP: <feature name>

## Goal
One sentence: what this implements and why.

## Context
- Files to modify: list with one-line description of each change
- Files to create: same
- Patterns to follow: specific examples from the existing codebase (file:line)
- External dependencies: any new packages required

## Implementation steps
Numbered, ordered steps. Each step is atomic and verifiable.
Include the exact commands to run after each step to verify it worked.

## Validation
Commands to run when all steps are done:
- [ ] <test command>
- [ ] <lint/typecheck command>
- [ ] <any other verification>

## Confidence score
X/10 — one sentence on what drives uncertainty (if < 8).
```

## Step 4 — Report

Tell the user:
- Where the PRP was saved
- Confidence score and what drives any uncertainty
- Suggested command to execute it: `claude` → new session → `/execute-prp PRPs/<feature>.md`
