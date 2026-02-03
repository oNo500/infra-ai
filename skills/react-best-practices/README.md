# React Best Practices (React 最佳实践)

一个结构化的存储库，用于创建和维护针对 agent 和 LLM 优化的 React 最佳实践。

## 结构

- `rules/` - 各个规则文件（每条规则一个）
  - `_sections.md` - 章节元数据（标题、影响、描述）
  - `_template.md` - 创建新规则的模板
  - `area-description.md` - 各个规则文件
- `src/` - 构建脚本和实用程序
- `metadata.json` - 文档元数据（版本、组织、摘要）
- __`AGENTS.md`__ - 编译输出（自动生成）
- __`test-cases.json`__ - 用于 LLM 评估的测试用例（自动生成）

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

4. 提取测试用例：
   ```bash
   pnpm extract-tests
   ```

## 创建新规则

1. 复制 `rules/_template.md` 到 `rules/area-description.md`
2. 选择合适的区域前缀：
   - `async-` 用于 Eliminating Waterfalls (第 1 节)
   - `bundle-` 用于 Bundle Size Optimization (第 2 节)
   - `server-` 用于 Server-Side Performance (第 3 节)
   - `client-` 用于 Client-Side Data Fetching (第 4 节)
   - `rerender-` 用于 Re-render Optimization (第 5 节)
   - `rendering-` 用于 Rendering Performance (第 6 节)
   - `js-` 用于 JavaScript Performance (第 7 节)
   - `advanced-` 用于 Advanced Patterns (第 8 节)
3. 填写 frontmatter 和内容
4. 确保你有解释清晰的示例
5. 运行 `pnpm build` 以重新生成 AGENTS.md 和 test-cases.json

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

**Incorrect (错误示范 - 描述问题所在):**

```typescript
// 糟糕的代码示例
```

**Correct (正确示范 - 描述正确做法):**

```typescript
// 优秀的代码示例
```

示例后的可选解释文本。

参考: [链接](https://example.com)

## 文件命名约定

- 以 `_` 开头的文件是特殊的（从构建中排除）
- 规则文件：`area-description.md`（例如，`async-parallel.md`）
- 章节根据文件名前缀自动推断
- 规则在每节内按标题按字母顺序排序
- ID（例如 1.1，1.2）在构建期间自动生成

## 影响级别 (Impact Levels)

- `CRITICAL` - 最高优先级，主要性能提升
- `HIGH` - 显著的性能提升
- `MEDIUM-HIGH` - 中高提升
- `MEDIUM` - 中等性能提升
- `LOW-MEDIUM` - 中低提升
- `LOW` - 增量改进

## 脚本

- `pnpm build` - 将规则编译到 AGENTS.md
- `pnpm validate` - 验证所有规则文件
- `pnpm extract-tests` - 提取用于 LLM 评估的测试用例
- `pnpm dev` - 构建并验证

## 贡献

添加或修改规则时：

1. 使用正确的章节文件名前缀
2. 遵循 `_template.md` 结构
3. 包含清晰的 错误/正确 示例和解释
4. 添加适当的标签
5. 运行 `pnpm build` 以重新生成 AGENTS.md 和 test-cases.json
6. 规则按标题自动排序 - 无需管理编号！

## 致谢

最初由 [Vercel](https://vercel.com) 的 [@shuding](https://x.com/shuding) 创建。
