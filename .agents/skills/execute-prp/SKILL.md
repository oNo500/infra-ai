---
name: execute-prp
description: >
  PRP workflow step 2: execute an implementation blueprint in a fresh session.
  Trigger when the user provides a PRP file path and asks to implement it.
  Trigger phrases: "execute PRP", "implement this PRP", "/execute-prp", "run the PRP".
disable-model-invocation: true
---

# Execute PRP

Implement the blueprint at `PRPs/<feature>.md` in this fresh session.

This session has no memory of the research that produced the PRP. That is intentional:
a clean context produces cleaner implementation than one polluted by exploration noise.

## Step 1 — Read the blueprint

Read the PRP file the user specified. If no file was given, ask for the path.

Confirm you understand:
- The goal (one sentence)
- Which files change and how
- The validation commands

## Step 2 — Plan before touching code

Think through the implementation steps. If anything is ambiguous or the confidence
score in the PRP is below 7, ask the user to clarify before writing any code.

Say: "I'm going to implement this in N steps. Here's my plan: ..."
Wait for the user to confirm before proceeding.

## Step 3 — Implement

Follow the PRP steps in order. After each step:
- Run the verification command specified in the PRP
- If it fails, fix before moving to the next step — do not accumulate broken state

## Step 4 — Validate

Run all validation commands from the PRP's Validation section.
All checks must pass before reporting completion.

If a check fails after implementation:
1. Read the error carefully
2. Fix the root cause (not the symptom)
3. Re-run the full validation suite, not just the failing check

## Step 5 — Report

When all validations pass:
- List what was implemented (files created/modified)
- Confirm all validation commands passed with their output
- Note anything that deviated from the PRP and why
