

## 输出文件

普通项目：
```
CLAUDE.md                           # 主入口，由 Claude Code 自动加载
.claude/docs/constitution.md        # 核心原则与不可违反的规则
.claude/docs/project-context.md     # 技术栈、架构、编码规范、工作流、测试与修改规则
```

Monorepo：
```
CLAUDE.md                           # 仅此一个文件，保持高层次
```

## 模板

| 输出文件 | 模板 | 适用 |
|----------|------|------|
| `CLAUDE.md` | [assets/CLAUDE-monorepo.md](assets/CLAUDE-monorepo.md) | Monorepo |
| `CLAUDE.md` | [assets/CLAUDE.md](assets/CLAUDE.md) | 普通项目 |
| `.claude/docs/constitution.md` | [assets/constitution.md](assets/constitution.md) | 普通项目 |
| `.claude/docs/project-context.md` | [assets/project-context.md](assets/project-context.md) | 普通项目 |

填写模板时，读取 [filling-guide](references/filling-guide.md)。

## 工作流

### 第一步：探索项目

提问之前，先读取项目文件：

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

Monorepo 判断依据（满足任意一条即判定）：
- `package.json` 含 `"workspaces"` 字段
- 根目录存在 `pnpm-workspace.yaml`
- 根目录存在 `turbo.json` / `nx.json` / `lerna.json`
- 存在 `packages/`、`apps/`、`libs/` 等多包目录

---

## Monorepo 工作流

### 第三步：确认关键信息

仅针对无法推断的信息提问，每轮不超过 3 个问题：
- 这个 monorepo 的整体用途是什么？（1-2 句话）
- 各主要包/应用的职责是什么？
- 有哪些跨包的不可违反约束？

若探索已能回答某个问题，跳过不问。

### 第四步：生成文件

读取 `assets/CLAUDE-monorepo.md`，替换占位符，生成根目录 `CLAUDE.md`。

### 第五步：总结

- 汇报已创建/更新的文件
- 突出 2-3 条关键跨包约束
- 提示：可在各子包目录下单独运行 `/repo-context` 生成更详细的文档

---

## 普通项目工作流

### 第三步：确认关键信息

仅针对无法从代码库推断的信息提问，每轮不超过 3 个问题：
- 这个项目的主要用途是什么？（1-2 句话）
- 有哪些重要约束或不可违反的规则？
- 主要贡献者/团队背景是什么？

若探索已能回答某个问题，跳过不问。

### 第四步：生成文件

按顺序生成 3 个文件，每个文件读取对应模板，替换占位符后写入项目目录：

1. `.claude/docs/constitution.md` — 读取 `assets/constitution.md`；版本从 `1.0.0` 开始，日期用今天
2. `.claude/docs/project-context.md` — 读取 `assets/project-context.md`
3. `CLAUDE.md` — 读取 `assets/CLAUDE.md`，最后生成，引用前两个文档

### 第五步：总结

- 列出已创建的文件
- 突出 constitution.md 中捕获的 2-3 条关键原则
- 建议：运行 `claude` 验证上下文是否正确加载

---

## 核心原则

- **说明原因** — constitution.md 中每条规则必须包含理由，而不只是规则本身
- **真实优于模板** — 用实际项目信息替换所有占位符；不适用的章节直接删除
- **保持简洁** — CLAUDE.md 应控制在 200 行以内；详细内容放入 `.claude/docs/`
- **便于发现** — CLAUDE.md 链接所有文档；每个文档自成体系

