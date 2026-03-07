---
name: project-context-template
description: .claude/docs/project-context.md 的模板 - 项目上下文综合文档
---

# Project Context 模板

用于生成 `.claude/docs/project-context.md`。

---

## 模板

```markdown
# [PROJECT_NAME] - Project Context

## Project Overview

[PROJECT_DESCRIPTION]
<!-- 1-3 句话：项目用途、目标用户、核心价值 -->

**Type**: [PROJECT_TYPE]
<!-- 示例：Web App、CLI Tool、npm Library、API Server、Monorepo -->

**Runtime**: [RUNTIME] | **Package Manager**: [PACKAGE_MANAGER]

## Tech Stack

### Core

| Technology | Purpose |
|------------|---------|
| [FRAMEWORK_OR_LIB] | [PURPOSE] |
| [FRAMEWORK_OR_LIB] | [PURPOSE] |

### Key Libraries

| Library | Category | Usage in This Project |
|---------|----------|-----------------------|
| [LIB] | [CATEGORY] | [HOW_USED] |
| [LIB] | [CATEGORY] | [HOW_USED] |

### Toolchain

| Tool | Config File | Purpose |
|------|-------------|---------|
| [TOOL] | [CONFIG_FILE] | [PURPOSE] |
| [TOOL] | [CONFIG_FILE] | [PURPOSE] |

## Architecture

**Pattern**: [ARCHITECTURE_PATTERN]
<!-- 示例：Feature-Based、Layered、Domain-Driven、MVC -->

```
[PROJECT_ROOT]/
├── [DIR]/     # [PURPOSE]
├── [DIR]/     # [PURPOSE]
│   ├── [DIR]/ # [PURPOSE]
│   └── [DIR]/ # [PURPOSE]
└── [FILE]     # [PURPOSE]
```
<!-- 只列非显而易见的目录；跳过 README.md、package.json 等标准文件 -->

### Key Decisions

**[DECISION_TITLE]**: [DECISION_DESCRIPTION]
<!-- 说明做了什么决定、为什么、对日常开发的影响 -->

## Coding Conventions

### Naming

| Context | Convention | Example |
|---------|------------|---------|
| Variables / Functions | [CONVENTION] | `[EXAMPLE]` |
| Types / Interfaces | [CONVENTION] | `[EXAMPLE]` |
| Files | [CONVENTION] | `[EXAMPLE]` |
| [CONTEXT] | [CONVENTION] | `[EXAMPLE]` |

### Patterns

```[LANGUAGE]
// [PATTERN_DESCRIPTION]: correct usage
[CORRECT_EXAMPLE]

// avoid: [REASON]
[ANTIPATTERN_EXAMPLE]
```

### File Organization

- [RULE]
<!-- 示例："每个文件一个组件"、"测试文件与源文件并置：foo.ts + foo.test.ts" -->
- [RULE]

## Development Workflow

### Setup

```bash
# Install dependencies
[INSTALL_COMMAND]

# Configure environment
[ENV_SETUP_COMMAND]

# Start dev server
[DEV_COMMAND]
```

### Common Tasks

```bash
# [TASK_1]
[COMMAND]

# [TASK_2]
[COMMAND]

# [TASK_3]
[COMMAND]
```

### Key Scripts

| Script | Description |
|--------|-------------|
| `[SCRIPT]` | [DESCRIPTION] |
| `[SCRIPT]` | [DESCRIPTION] |

## Testing Rules

- **[TESTING_RULE_1]**
<!-- 示例："MUST write tests before implementation (TDD)" -->
- **[TESTING_RULE_2]**
<!-- 示例："Unit tests colocated with source; integration tests in tests/" -->
- **[TESTING_RULE_3]**

```bash
# Run all tests
[TEST_COMMAND]

# Run specific test
[TEST_FILTER_COMMAND]
```

## Modification Rules

- **[MODIFICATION_RULE_1]**
<!-- 示例："MUST read the file before editing" -->
- **[MODIFICATION_RULE_2]**
<!-- 示例："Prefer editing existing files over creating new ones" -->
- **[MODIFICATION_RULE_3]**
<!-- 示例："Confirm before irreversible operations (delete, force push)" -->
```

---

## AI 填写指南

### 占位符填充规则

- **从仓库上下文推断** — 优先从 `package.json`、`tsconfig.json`、配置文件、README 中提取，再向用户提问
- **不留方括号 token** — 所有 `[ALL_CAPS]` 占位符必须替换为真实内容；不适用的章节整节删除
- **注释可删除** — `<!-- -->` 注释替换后无需保留

### 各章节填写要点

**Tech Stack**
- Core 只列框架级依赖（不列工具库）
- Key Libraries 只为非显而易见的库写用法说明；React、Express 等标准库可省略
- 突出项目特有选择，如"用 Zustand 不用 Redux"

**Architecture**
- 目录结构只列有独立职责的目录，跳过标准文件
- Key Decisions 优先记录非显而易见的决策；遵循惯例的无需记录

**Coding Conventions**
- 不记录 linter 能强制的规则（缩进、引号、分号等）；只记录需要人工遵守的约定
- 从现有源文件的模式中推断命名约定

**Development Workflow**
- 命令从 `package.json` 脚本中取，使用实际脚本名
- 按使用频率排序；非显而易见的步骤说明原因

**Testing Rules**
- 声明性、可测试 — 避免模糊语言（"应该" → "MUST"/"禁止"）
- 包含实际可运行的测试命令

**Modification Rules**
- 针对 AI agent 的行为约束，说明哪些操作需要确认、哪些模式禁止
