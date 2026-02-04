---
trigger: always_on
---

# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在处理此仓库代码时提供指导。

## 核心原则

- **禁止 emoji**: 代码中不使用 emoji（除非用户明确要求）
- **最小化实现**: 遵循 MVP 原则，如非必要不进行拓展

# Skills 生成器

从项目文档生成 [Agent Skills](https://agentskills.io/home)。

请严格遵循 SKILL 的最佳实践：https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices

- 专注于 agent 能力和实际使用模式
- 忽略面向用户的指南、介绍、入门教程、安装指南等
- 忽略 LLM agent 在其训练数据中已经熟知的内容
- 使 skill 尽可能简洁，避免创建过多引用

## Skill 来源类型

有两种类型的 skill 来源。项目列表定义在 `meta.ts` 中：

### 类型 1: 生成的 Skills (`sources/`)

用于**没有现有 skills** 的 OSS 项目。我们将仓库克隆为子模块，并从其文档生成 skills。

- **项目:** Vue, Nuxt, Vite, UnoCSS
- **工作流:** 阅读文档 → 理解 → 生成 skills
- **来源:** `sources/{project}/docs/`

### 类型 2: 同步的 Skills (`vendor/`)

用于**已经维护自己 skills** 的项目。我们将其仓库克隆为子模块，并将指定的 skills 同步到我们的仓库。

- **项目:** Slidev, VueUse
- **工作流:** 拉取更新 → 复制指定的 skills（可选择重命名）
- **来源:** `vendor/{project}/skills/{skill-name}/`
- **配置:** 每个 vendor 在 `meta.ts` 中指定要同步的 skills 及其输出名称

### 类型 3: 手写 Skills

由 Anthony Fu 根据他的偏好、经验、品味和最佳实践编写的 skills。

除非被要求，否则你不需要对它们做任何事情。

## 仓库结构

```
.
├── meta.ts                     # 项目元数据（仓库和 URL）
├── instructions/               # 生成 skills 的说明
│   └── {project}.md            # 为 {project} 生成 skills 的说明
│ 
├── sources/                    # 类型 1: OSS 仓库（从文档生成）
│   └── {project}/
│       └── docs/               # 从此处读取文档
│
├── vendor/                     # 类型 2: 已有 skills 的项目（仅同步）
│   └── {project}/
│       └── skills/
│           └── {skill-name}/   # 要同步的单个 skills
│
└── skills/                     # 输出目录（生成或同步）
    └── {output-name}/
        ├── SKILL.md           # 所有 skills 的索引
        ├── GENERATION.md       # 跟踪元数据（用于生成的 skills）
        ├── SYNC.md             # 跟踪元数据（用于同步的 skills）
        └── references/
            └── *.md            # 单个 skill 文件
```

**重要提示:** 对于类型 1（生成），`skills/{project}/` 名称必须与 `sources/{project}/` 匹配。对于类型 2（同步），输出名称在 `meta.ts` 中配置，可能与源 skill 名称不同。

## 工作流

### 生成的 Skills（类型 1）

#### 添加新项目

1. **在 `meta.ts` 中添加条目**到 `submodules` 对象：
   ```ts
   export const submodules = {
     // ... 现有条目
     'new-project': 'https://github.com/org/repo',
   }
   ```

2. **运行同步脚本**以克隆子模块：
   ```bash
   nr start init -y
   ```
   这将把仓库克隆到 `sources/{project}/`

3. **遵循下面的生成指南**来创建 skills

#### 生成的通用说明

- 专注于 agent 能力和实际使用模式。对于面向用户的指南、介绍、入门教程或 LLM agent 已知的常识，可以跳过这些内容。
- 将每个引用分类为 `core`、`features`、`best-practices`、`advanced` 等类别，并在引用文件名前添加类别前缀。对于每个功能字段，如果需要更好地组织内容，可以自由创建更多类别。

#### 创建新 Skills

- **阅读**来自 `sources/{project}/docs/` 的源文档
- **阅读** `instructions/{project}.md` 中的说明（如果存在）以获取特定的生成说明
- **彻底理解**文档
- **创建** skill 文件到 `skills/{project}/references/`
- **创建** `SKILL.md` 索引，列出所有 skills
- **创建** `GENERATION.md` 并记录源 git SHA

#### 更新生成的 Skills

1. **检查** `GENERATION.md` 中记录的 SHA 以来的 git diff：
   ```bash
   cd sources/{project}
   git diff {old-sha}..HEAD -- docs/
   ```
2. **根据变更更新**受影响的 skill 文件
3. **更新** `SKILL.md`，包含工具/项目的新版本和 skills 表
4. **更新** `GENERATION.md` 中的新 SHA

### 同步的 Skills（类型 2）

#### 初始同步

1. **复制**指定的 skills 从 `vendor/{project}/skills/{skill-name}/` 到 `skills/{output-name}/`
2. **创建** `SYNC.md` 并记录 vendor git SHA

#### 更新同步的 Skills

1. **检查** `SYNC.md` 中记录的 SHA 以来的 git diff：
   ```bash
   cd vendor/{project}
   git diff {old-sha}..HEAD -- skills/{skill-name}/
   ```
2. **复制**更改的文件从 `vendor/{project}/skills/{skill-name}/` 到 `skills/{output-name}/`
3. **更新** `SYNC.md` 中的新 SHA

**注意:** 不要手动修改同步的 skills。更改应该贡献到上游的 vendor 项目。

## 文件格式

### `SKILL.md`

索引文件，列出所有 skills 及简要描述。名称应使用 `kebab-case`。

版本应为最后一次同步的日期。

还要记录生成 skills 时工具/项目的版本。

```markdown
---
name: {name}
description: {description}
metadata:
  author: Anthony Fu
  version: "2026.1.1"
  source: Generated from {source-url}, scripts located at https://github.com/antfu/skills
---

> 该 skill 基于 {project} v{version}，生成于 {date}。

// 项目的简洁摘要/上下文/介绍

## Core References

| Topic | Description | Reference |
|-------|-------------|-----------|
| Markdown Syntax | Slide separators, frontmatter, notes, code blocks | [core-syntax](references/core-syntax.md) |
| Animations | v-click, v-clicks, motion, transitions | [core-animations](references/core-animations.md) |
| Headmatter | Deck-wide configuration options | [core-headmatter](references/core-headmatter.md) |

## Features

### Feature a

| Topic | Description | Reference |
|-------|-------------|-----------|
| Feature A Editor | Description of feature a | [feature-a](references/feature-a-foo.md) |
| Feature A Preview | Description of feature b | [feature-b](references/feature-a-bar.md) |

### Feature b

| Topic | Description | Reference |
|-------|-------------|-----------|
| Feature B | Description of feature b | [feature-b](references/feature-b-bar.md) |

// ...
```

### `GENERATION.md`

生成的 skills（类型 1）的跟踪元数据：

```markdown
# Generation Info

- **Source:** `sources/{project}`
- **Git SHA:** `abc123def456...`
- **Generated:** 2024-01-15
```

### `SYNC.md`

同步的 skills（类型 2）的跟踪元数据：

```markdown
# Sync Info

- **Source:** `vendor/{project}/skills/{skill-name}`
- **Git SHA:** `abc123def456...`
- **Synced:** 2024-01-15
```

### `references/*.md`

单个 skill 文件。每个文件一个概念。

在文件末尾，包含指向源文档的引用链接。

```markdown
---
name: {name}
description: {description}
---

# {概念名称}

简要描述此 skill 涵盖的内容。

## Usage

代码示例和实际模式。

## Key Points

- 重要细节 1
- 重要细节 2

<!--
源引用:
- {source-url}
- {source-url}
- {source-url}
-->
```

## 编写指南

生成 skills 时（仅类型 1）：

1. **为 agent 重写** - 不要逐字复制文档；为 LLM 消费进行综合
2. **注重实用性** - 专注于使用模式和代码示例
3. **保持简洁** - 删除冗余内容，保留关键信息
4. **每个文件一个概念** - 将大主题拆分为单独的 skill 文件
5. **包含代码** - 始终提供可工作的代码示例
6. **解释原因** - 不仅说明如何使用，还要说明何时以及为何使用

## 支持的项目

查看 `meta.ts` 以获取项目及其仓库 URL 的规范列表。
