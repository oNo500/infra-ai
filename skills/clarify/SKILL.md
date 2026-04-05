---
name: clarify
description: >
  Analyze any complex content and restructure it into human-readable visual formats.
  Use when asked to explain, summarize, diagram, map, or visualize any concept, code,
  flow, document, or system. Automatically selects the best format based on information type.
  Trigger phrases: "梳理一下", "帮我理解", "画个图", "解释一下", "整理成", "visualize",
  "diagram", "breakdown", "explain this", "map this out", "clarify".
---

# Clarify

Restructure complex input into the most human-readable format for its information type.

## Output Structure

Always output in this order:

1. **Analogy** — one sentence comparing the subject to something from everyday life
2. **Visual** — diagram, tree, or table (see format selection below)
3. **Key points** — 3–5 bullets on what matters most
4. **Gotcha** — one common misconception or non-obvious detail worth flagging

Keep each section tight. No preamble. For simple inputs, skip Key points if the visual is self-explanatory.

## Step 1: Select Format

| Information Type | Signals | Format |
|-----------------|---------|--------|
| Hierarchy / containment | nested structure, "consists of", file trees | ASCII tree |
| Process / flow | steps, decisions, branching, "then" | Mermaid flowchart |
| Sequence / interaction | actors, requests, responses, timeline | Mermaid sequenceDiagram |
| Comparison / options | pros/cons, feature matrix, "vs" | Table |
| Concept network | relationships, dependencies, "connects to" | Mermaid graph |
| Mixed / large system | multi-aspect topic, architecture overview | Sections + mixed formats |

When in doubt, prefer simpler: ASCII tree over Mermaid if hierarchy is shallow; table over graph if relationships are few.

## Step 2: Format Reference

**ASCII tree** — hierarchies:
```
Root
├── Child A
│   ├── Grandchild 1
│   └── Grandchild 2
└── Child B
```

**Mermaid flowchart** — processes with decisions:
```mermaid
flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action]
    B -->|No| D[Other]
```

**Mermaid sequenceDiagram** — actor interactions:
```mermaid
sequenceDiagram
    Client->>Server: Request
    Server-->>Client: Response
```

**Table** — comparisons:
| Option | Pro | Con |
|--------|-----|-----|

**Mermaid graph** — concept networks:
```mermaid
graph LR
    A[Concept] --> B[Related]
    A --> C[Related]
```
