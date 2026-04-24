---
name: claude-md-workshop
description: Review, scaffold, or consult on CLAUDE.md / AGENTS.md / .claude/rules/*.md files using workshop methodology (authenticity three-question test, nine anti-patterns, carrier upgrades, six-stage evolution). Use when user asks to audit or review an existing CLAUDE.md/AGENTS.md, scaffold a new one for a project, or consult on specific rule wording/structure/placement. Triggers on phrases like "审一下 CLAUDE.md", "check this CLAUDE.md", "帮我建一份", "这条怎么改", "应该放哪里", or any mention of CLAUDE.md, AGENTS.md, .claude/rules/.
---

# claude-md-workshop

核心哲学：**CLAUDE.md 是长出来的，不是设计出来的。**

继承 workshop 元规范的三个基本立场：
- 规则要对应真实犯错，不对应真实失败的规则删掉
- 验证 > 规则（能被 lint/test/hook 验证的规则应该迁移出去）
- 骨架 → 试用 → 反向追加 → 裁剪 → 载体升级 → 稳定（六阶段）

本 skill 不替换 `claude-md-management:claude-md-improver`——观点不同，并存使用。

## 共享禁令（三个模式都遵守）

- 不主动修改用户文件，除非用户明确说"帮我改"
- 不一次产出完整版 CLAUDE.md（生成模式严格骨架，审查模式只出建议）
- 不复述 references 整段内容，点名引用即可
- 不和 `claude-md-improver` 对比优劣
- 不对不确定的项目类型硬猜，问用户

## 模式路由

### 审查模式（review）

**触发信号**：
- "审一下" / "check this CLAUDE.md" / "audit" / "这份有什么问题"
- 用户贴一份完整 CLAUDE.md / AGENTS.md 内容
- 用户指向一个现有 CLAUDE.md 文件路径

**加载**：`references/review.md` → 跟着它的工作流读 `references/checklist.md` 和 `references/principles.md`

**产出**：一份 markdown 审查报告（总评 / 清单 ✓△✗ / 反模式命中 / before-after 改写建议 / 载体升级建议）。**不动用户文件。**

### 生成模式（scaffold）

**触发信号**：
- "帮我建一份" / "初始化" / "scaffold"
- 项目根没有 CLAUDE.md，用户问"这个项目怎么配 Claude"
- 用户明确说"给这个项目生成 CLAUDE.md"

**加载**：`references/scaffold.md` → 跟着它做问卷 → 按答案选 `assets/skeleton-*.md`

**产出**：一份 < 30 行的骨架 `CLAUDE.md`（+ 可选的 `AGENTS.md`），附迭代提醒。**不生成** Code Style / Testing Strategy / 架构哲学段——按元规范这些属于"长出来才加"。

### 咨询模式（consult）

**触发信号**：
- "这条怎么改" / "应该放哪" / "这个写法对吗"
- 用户贴一小段（不是整份）草稿询问
- 用户问 CLAUDE.md 的某个具体写法/结构问题

**加载**：`references/consult.md` → 按主题再按需加载 `references/principles.md` 某节或 `assets/examples/` 某份

**产出**：结论 + 理由（一次一条，不展开全部）。需要重写时给 before/after 对照。

## 优先级

用户明确指令 > 本 skill 规则 > 默认系统行为
