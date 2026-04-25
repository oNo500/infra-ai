# Constitution (Knowledge & Documentation)

## Core Principles
- **MECE Framework**: structure information to be Mutually Exclusive, Collectively Exhaustive
- **Outline-first**: define heading hierarchy and logical flow before generating bulk content
- **Single Source of Truth**: reference existing documents; strictly NO conceptual duplication
- **Atomic Focus**: keep individual notes/documents tightly focused on a single topic
- **Fact-grounded**: synthesize strictly from provided context or verifiable sources; NO hallucinations

## Format & Workflow
- **Syntax**: Use strict Markdown with YAML frontmatter for metadata
- **Linking**: Prefer bi-directional wikilinks (`[[Concept]]`) for knowledge graph mapping
- **Search & Retrieval**: Rely on semantic search/RAG for concept discovery; use `rg` for exact terminology matching
- **Information Gathering**: Local RAG -> Exa (Deep research) -> Brave Search (General)

## Agent Behavior
- **When unsure, ASK**
- **Clarify missing context**: If a prompt lacks necessary premises, request them before writing

## Things That Will Bite You
- **Orphaned Links**: Renaming headers or files without updating back-references breaks the knowledge graph
- **Tag/Category Pollution**: ALWAYS check existing metadata/tags before creating new, synonymous ones


# Claude Code Obsidian PKM Rules

## 1. Routing (JD + PARA)
**Directory Map**: `00-inbox`, `10-projects`, `20-areas`, `30-resources`, `90-archive`, `99-system`.
**Decision Chain**: 
System/Template? -> `99` | Has Deadline? -> `10` | Done? -> `90/{YYYY}` | Active? -> `20` | Reference Only? -> `30` | Unsure? -> `00`

## 2. Naming & Types
- **Directories**: Max 2 levels. Strictly `kebab-case` (all lowercase, no exceptions).
- **Files**: `{Area}-{Type}-{Theme}.md`
  - *Area*: `UPPERCASE` for custom acronyms (`JS`, `TS`, `API`, `DSA`), Brand Casing for tech (`React`, `NestJS`).
  - *Type (Strict Enum)*: `concept` | `cheatsheet` | `practice` | `reference` | `note` | `book`.
  - *Theme*: Chinese must be all lowercase; English uses Brand Casing.
- **Specials**: MOC (`00-MOC-{Theme}.md`), Dailies (`YYYY-MM-DD.md`).
- **Forbidden**: Spaces, `! | ? * :`, or names like `temp`/`untitled`.

## 3. Obsidian Syntax Constraints
- **Layout**: Target < 200 lines. Split if > 500 lines. MOC max 150 lines.
- **Callouts**: `[!warning]`, `[!faq]-` (collapsed), `[!tip]+` (expanded).
- **Highlights**: Use `==core terms==`.
- **Block IDs**: Use `^block-id` for precise cross-file referencing.
- **Dividers (`---`)**: ONLY for major content jumps within a section. NEVER place between heading tags.

## 4. Metadata (YAML Frontmatter)
Must strictly follow this schema. 
**CRITICAL**: NEVER hallucinate `jd_id`. You MUST execute `TZ='Asia/Shanghai' date '+%Y-%m-%d %H:%M'` to get the value.
```yaml
---
title: <Document Title>
jd_id: JXX-YYYYMMDD-HHMM
created: YYYY-MM-DD HH:MM
origin: <Source>
tags: [draft] # progression: draft -> growing -> evergreen
---