# Next.js Architecture (Next.js 架构指南)

一个结构化的存储库，用于创建和维护针对 agent 和 LLM 优化的 Next.js 项目架构规范。

## 结构

- `rules/` - 各个规则文件（每条规则一个）
  - `_sections.md` - 章节元数据（标题、影响、描述）
  - `_template.md` - 创建新规则的模板
  - `area-description.md` - 各个规则文件
- `metadata.json` - 文档元数据（版本、组织、摘要）
- __`AGENTS.md`__ - 编译输出（自动生成）

## 快速开始

1. 安装依赖：
   ```bash
   pnpm install
   ```

2. 从规则构建 AGENTS.md：
   ```bash
   pnpm build
   ```

3. 验证规则文件：
   ```bash
   pnpm validate
   ```

## 创建新规则

1. 复制 `rules/_template.md` 到 `rules/area-description.md`
2. 选择合适的区域前缀：
  - arch- = 架构模式、模块化、数据流
  - std- = 命名规范、导入规范、样式规范
  - dev- = 框架、UI库、状态管理、工具链
3. 填写 frontmatter 和内容
4. 运行 `pnpm build` 以重新生成 AGENTS.md

## 规则文件结构

每个规则文件应遵循以下结构：

```markdown
---
title: 此处填写规则标题
impact: MEDIUM
impactDescription: 可选描述
tags: 标签1, 标签2, 标签3
---

## 此处填写规则标题

简要解释规则及其重要性。

核心要求：
- 要求 1
- 要求 2
```

## 文件命名约定

- 以 `_` 开头的文件是特殊的（从构建中排除）
- 规则文件：`area-description.md`（例如，`arch-core.md`）
- 章节根据文件名前缀自动推断

## 影响级别 (Impact Levels)

- `CRITICAL` - 最高优先级，架构基础
- `HIGH` - 重要的项目标准
- `MEDIUM` - 开发规范和工具配置
