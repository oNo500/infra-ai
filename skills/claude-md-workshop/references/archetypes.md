# 五种风格原型 + 骨架映射

> 来源镜像：`ai-practice-CLAUDEmd样本.md` §1。生成模式按项目类型选择骨架。

## 原型速查

| 原型 | 行数 | 代表 | 核心段 | 对应 skeleton |
|------|------|------|--------|---------------|
| 1. 极简工具型 | 50-100 | claude-code-action (49) / sloppy-xml-py (91) / humanlayer (93) | Things That Will Bite You | `skeleton-minimal.md` |
| 2. 极简个人 | 50-110 | rlch (86) / ryoppippi (110) | 仓库概览 + 命令速查 + tree | `skeleton-minimal.md` |
| 3. 方法论驱动 | 160-350 | centminmod / harperreed (274) / SuperClaude (346) | 协作哲学 + 决策框架 + TDD 协议 | `skeleton-app.md`（起点） |
| 4. 多 Agent 编排 | 120-880 | wshobson / BMAD / Fission-AI | agent catalog + model routing | 不直接支持，按需组合 |
| 5. 领域化企业级 | 270-1850 | zircote / Yeachan-Heo / SuperClaude_Framework | 主文件 + `includes/` 分册 | 不直接支持，按需组合 |

> 用户偏好：不使用表格。上述表仅在 skill 内部供 Claude 查询路由用，产出给用户的报告用列表。

## 原型判断决策

按顺序问自己：

1. **monorepo**（有 pnpm-workspace / turbo.json / nx.json）？
   → 先给根 `CLAUDE.md` 用 minimal，再为每个实质子包用 `skeleton-monorepo.md`
2. **dotfiles 或单文件工具/库/CLI**？→ `skeleton-minimal.md`
3. **应用/产品项目**（Next / Nest / FastAPI / Django / Rails 等）？→ `skeleton-app.md`
4. **方法论/哲学重度依赖的项目**（用户明说）？→ 从 `skeleton-app.md` 起，后续建议按 harperreed / SuperClaude 模式扩充
5. **多 Agent 编排或企业级 includes 架构**？→ 本 skill 只给一份骨架，扩充方向给用户指向 workshop 样本，不包办

## 各原型的核心段清单（骨架之外的可选扩充）

### 极简工具型（扩充方向）
- Commands 段（速查）
- How It Runs（主入口 + 关键路径）
- Key Concepts（3-5 条一句话解释）
- **Things That Will Bite You**（最高信号段）
- Code Conventions（≤ 4 条）

### 极简个人（扩充方向）
- 仓库概览（一句话 + tree 图）
- 命令速查
- 工具偏好（rg / fd / gh 等）
- 关键约束

### 方法论驱动（扩充方向）
- 协作哲学段（仅当遇到真实谄媚导致的错误时）
- TDD / 验证协议
- Mistake Logging
- XML tag 分段（可选）

### 多 Agent 编排（扩充方向）
- Agent Catalog
- Model Routing
- "If You Are an AI Agent" 强警告段

### 领域化企业级（扩充方向）
- 主 CLAUDE.md + `includes/*.md` 分册
- 按语言/层级拆分（`python.md` / `testing.md` / `git.md`）

## 给生成模式的硬约束

无论哪种原型，阶段 1 骨架**只给**：

- 项目一行摘要
- Golden Rule
- NEVER（≤ 5 条，用户说的真实禁区）
- 快速命令
- 保护区
- 末尾重复 NEVER

**不给**：Code Style / Testing Strategy / 架构哲学 / 协作理念段。按元规范，这些属于"长出来才加"。
