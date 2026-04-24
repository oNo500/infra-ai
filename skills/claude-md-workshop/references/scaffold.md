# 生成模式工作流

> 当 SKILL.md 路由到生成模式时，按本文件执行。

## 适用输入

- 用户在项目根说"帮我建一份 CLAUDE.md" / "初始化" / "scaffold"
- 项目根没有 CLAUDE.md，用户问起相关话题
- 用户明确说"给这个项目生成 CLAUDE.md"

## 步骤

### 步骤 1：扫仓库判类型

并行读：
- `package.json`（如果存在）
- `pyproject.toml`（如果存在）
- `Cargo.toml`（如果存在）
- `go.mod`（如果存在）
- `pnpm-workspace.yaml` / `turbo.json` / `nx.json`（判断 monorepo）

**不存在的文件不要报错，有就读。**

根据结果推断：
- 有 workspace 配置 → monorepo
- 有 `Next` / `react` 依赖 → 前端应用
- 有 `NestJS` / `Express` / `Fastify` / `FastAPI` / `Django` → 后端应用
- 有 CLI 入口（`bin` 字段 / `__main__.py`）且无 web 依赖 → 工具/库
- 目录名含 `dotfiles` / `.dotfiles` / `chezmoi` 相关 → dotfiles

### 步骤 2：问卷（一次一个问题）

**Q1 项目类型**（带推荐）：

> 我扫到这是 <推断结果>，对应骨架是 `skeleton-<X>.md`。确认吗？（或告诉我应该用哪种：工具库 / 应用 / dotfiles / 多 Agent / 企业级）

**Q2 NEVER 禁区**：

> 这个项目有哪几条真实的「绝不能做」？（≤ 5 条。不要抄社区 best practices，只写你项目里真的会导致问题的。如果还没遇到过，留空也可以。）

**Q3 保护区路径**（可选）：

> 有哪些目录/文件是「改之前必须确认」的？（如 `src/auth/**` / `migrations/**` / `__tests__/**`。没有就跳过。）

**Q4 双文件模式**（可选，默认推荐）：

> 要不要采用 `AGENTS.md + CLAUDE.md` 双文件（推荐，多 AI 工具兼容）？还是单一 `CLAUDE.md`？

**Q5 已踩过的坑**（可选）：

> 有没有已经遇到过的「只有读过源码才知道」的陷阱？（Things That Will Bite You 段的素材。没有就跳过，后续迭代时再补。）

**提问原则**：
- 每次只问一个问题，不批量
- Q3/Q4/Q5 可以问"跳过还是写一条"，用户说跳就跳
- 不要反复确认用户的回答，第一次答就收进去

### 步骤 3：选骨架模板

按 Q1 答案：
- 工具库 / dotfiles → `assets/skeleton-minimal.md`
- 应用 / 产品 → `assets/skeleton-app.md`
- monorepo 根 → `assets/skeleton-monorepo.md`
- 双文件模式（Q4 选是）→ 叠加 `assets/skeleton-agents-md.md` 的结构

### 步骤 4：填空

用 Q2-Q5 的答案填入模板占位符。占位符约定（在 skeleton 文件里用 `{{...}}` 表示）：

- `{{project_summary}}` — 一句话技术栈摘要（从 package.json 等推断）
- `{{golden_rule}}` — 默认 `When unsure about requirements, implementation, or scope, ASK before changing code.`
- `{{never_list}}` — Q2 答案（如果为空，放一条默认 `NEVER push to main directly`）
- `{{commands}}` — 从 package.json `scripts` / Makefile 抽主要命令
- `{{protected_paths}}` — Q3 答案
- `{{bite_you}}` — Q5 答案（空 → 删掉整段）

### 步骤 5：产出骨架

将填好的骨架文件写入目标路径：

- 单文件模式 → `./CLAUDE.md`
- 双文件模式 → `./AGENTS.md` + `./CLAUDE.md`（CLAUDE.md 首行 `@AGENTS.md`，仅补 Claude 特有内容）
- monorepo → 根 `./CLAUDE.md` + 每个子包的 `apps/<name>/.claude/rules/<name>.md`（带 `paths: ["apps/<name>/**"]`）

写之前先 Read 检查目标文件是否已存在：
- 存在 → 停下问用户："目标文件已存在，要覆盖 / 追加 / 放弃？"
- 不存在 → 直接 Write

### 步骤 6：附迭代提醒

在产出文件末尾追加一行 comment（markdown `<!-- -->` 会被 CLAUDE.md 剥离，但用户能看到）：

```markdown
<!-- 这是阶段 1 骨架（< 30 行）。按元规范：先用 2-4 周，记录犯错到 .claude/gotchas.md；两周后回来做阶段 3 反向追加。参见 workshop/ai-practice-CLAUDEmd元规范.md -->
```

另外在对话里告诉用户：

> "骨架已写入 `<path>`。按元规范六阶段，接下来：
> 1. **不要**再往里加规则，用它 2-4 周
> 2. 每次 Claude 犯错，写到 `.claude/gotchas.md` 一行，先不升级
> 3. 两周后用本 skill 的审查模式重新跑一遍，决定哪些 gotcha 升级成规则"

### 步骤 7：禁做检查

产出之前自查：

- 是不是严格 < 30 行？超了就砍非骨架段（Code Style / Testing / 架构哲学必须砍）
- NEVER 是不是 ≤ 5 条？
- 首 5 行 + 末 3 行有没有重复绝对规则？
- Golden Rule 有没有？

有任何一项失败 → 回步骤 4 重填。

## 禁做

- 不一次铺完整版（≥ 50 行的骨架是失败）
- 不生成 Code Style / Testing Strategy / 架构哲学段
- 不猜 NEVER，只用用户说的
- 不在有现成 CLAUDE.md 的项目里静默覆盖
