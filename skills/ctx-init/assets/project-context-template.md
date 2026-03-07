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
