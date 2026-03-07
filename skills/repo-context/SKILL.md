---
name: repo-context
description: >
  为项目初始化结构化的 AI 上下文文档。使用场景：
  - 用户说"初始化 AI 上下文"、"为项目配置 Claude"、"创建 CLAUDE.md"、"初始化项目上下文"
  - 用户想替代或增强 `claude init`
  - 新项目缺乏结构化的 AI 助手上下文文档
  - 用户想为项目搭建 `.claude/` 目录结构
---

# repo-context


你正在更新 xxx 
你的工作是 (a) 收集/推导具体值，(b) 精确填充模板，(c) 将任何修改传播到依赖制品。

## 输出文件

普通项目：
```
CLAUDE.md                        # 主入口，由 Claude Code 自动加载
.claude/docs/constitution.md     # 核心原则与不可违反的规则
.claude/docs/quickstart.md       # 初始化设置与常用工作流
.claude/docs/architecture.md     # 系统设计与关键决策
.claude/docs/tech-stack.md       # 技术栈、版本与使用模式
.claude/docs/style-guide.md      # 代码风格与约定
```

Monorepo：
```
CLAUDE.md                        # 仅此一个文件，保持高层次
```

## 工作流

### 第一步：探索项目

提问之前，先读取项目文件，了解现有信息：

```
- package.json / pyproject.toml / Cargo.toml（依赖、脚本、项目名）
- README.md（项目概述、安装说明）
- 已有的 CLAUDE.md 或 .claude/ 目录
- 源码目录结构（src/、app/、lib/ 等）
- 配置文件（tsconfig.json、eslint.config.*、vite.config.* 等）
- CI/CD 文件（.github/workflows/ 等）
```

### 第二步：判断项目类型

**是 Monorepo？** → 遵循下方「Monorepo 工作流」
**普通项目？** → 遵循下方「普通项目工作流」

Monorepo 判断依据（满足任意一条）：
- `package.json` 含 `"workspaces"` 字段
- 根目录存在 `pnpm-workspace.yaml`
- 根目录存在 `turbo.json` 或 `nx.json` 或 `lerna.json`
- 存在 `packages/`、`apps/`、`libs/` 等多包目录

---

## Monorepo 工作流

### 第三步：确认关键信息

仅针对无法推断的信息提问（每轮不超过 3 个问题）：
- 这个 monorepo 的整体用途是什么？（1-2 句话）
- 各主要包/应用的职责是什么？
- 有哪些跨包的不可违反约束？

若探索已能回答某个问题，跳过不问。

### 第四步：生成文件

读取 [monorepo-agents](references/monorepo-agents.md)，用真实项目信息替换占位符，生成或更新根目录 `CLAUDE.md` 一个文件。

### 第五步：总结

- 汇报已创建/更新的文件
- 突出 2-3 条关键跨包约束
- 提示：可在各子包目录下单独运行 `/repo-context` 生成更详细的文档

---

## 普通项目工作流

### 第三步：确认关键信息

仅针对无法从代码库推断的信息向用户提问，每轮不超过 3 个问题：
- 这个项目的主要用途是什么？（1-2 句话）
- 有哪些重要约束或不可违反的规则？
- 主要贡献者/团队背景是什么？

若探索已能回答某个问题，跳过不问。

### 第四步：生成文件

按顺序生成全部 6 个文件。每个文件：
1. 读取 `references/` 中对应的模板
2. 用真实项目信息替换 `[占位符]`
3. 将文件写入项目目录

生成顺序：
1. `.claude/docs/constitution.md` — 先确立原则；读取 [constitution-template](references/constitution-template.md)，版本从 `1.0.0` 开始，日期用今天，原则数量以实际为准
2. `.claude/docs/tech-stack.md` — 记录 package.json/配置文件中已有的信息
3. `.claude/docs/architecture.md` — 基于探索结果描述项目结构
4. `.claude/docs/quickstart.md` — 基于脚本/README 整理实用工作流
5. `.claude/docs/style-guide.md` — 从 ESLint/Prettier/现有约定中提取
6. `CLAUDE.md` — 最后写，读取 [project-agents](references/project-agents.md) 模板，引用所有其他文档

### 第五步：总结

- 列出已创建的文件
- 突出 constitution.md 中捕获的 2-3 条关键原则
- 建议：在该目录下运行 `claude`，验证上下文是否正确加载

---

## 模板索引

| 文件 | 模板 | 适用 |
|------|------|------|
| CLAUDE.md（Monorepo）| [monorepo-agents](references/monorepo-agents.md) | Monorepo |
| CLAUDE.md（普通项目）| [project-agents](references/project-agents.md) | 普通项目 |
| constitution.md | [constitution-template](references/constitution-template.md) | 普通项目 |
| quickstart.md | [quickstart-template](references/quickstart-template.md) | 普通项目 |
| architecture.md | [architecture-template](references/architecture-template.md) | 普通项目 |
| tech-stack.md | [tech-stack-template](references/tech-stack-template.md) | 普通项目 |
| style-guide.md | [style-guide-template](references/style-guide-template.md) | 普通项目 |

## 核心原则

- **说明原因** — constitution.md 中每条规则必须包含理由，而不只是规则本身
- **真实优于模板** — 用实际项目信息替换所有占位符；不适用的章节直接删除
- **保持简洁** — CLAUDE.md 应控制在 200 行以内；详细内容放入 `.claude/docs/`
- **便于发现** — CLAUDE.md 链接所有文档；每个文档自成体系
