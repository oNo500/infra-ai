# Constitution

## Core Principles

### 一、Library-First

优先使用成熟的第三方库，禁止重复造轮子。引入新依赖前必须确认无等效库已在项目中存在。

### 二、MVP-First

功能最小化实现。只做当前需求必须的部分，禁止为假设的未来需求预建抽象或配置开关。

### 三、Functional Programming First

优先使用纯函数和不可变数据。禁止在不必要的情况下引入副作用和可变状态。

---

## 不可违反规则

- **TypeScript 类型**：禁止双重断言（`value as X as Y`）；禁止 `@ts-ignore`
- **文件命名**：文件与目录一律 kebab-case，React 组件文件同样适用，
  不为 PascalCase 惯例开豁免
- **禁止 emoji**：源代码中禁止使用 emoji（注释、日志输出除外，需明确标注原因）
- **Commit language**：commit message 使用英文，遵循 Conventional Commits 格式
- **不修改生成文件**：`AGENTS.md` 是构建产物，禁止手动编辑；只修改其对应的 rules 源文件
