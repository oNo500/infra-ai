# CLAUDE.md 写作准则（精简镜像）

> 来源镜像：`30-resources/ai/claude-md-workshop/notes/ai-reference-CLAUDEmd准则.md`。本文件只保留结论，深度细节看源文件。

## 1. 长度与拆分

- 单文件 **< 200 行**（Anthropic 官方硬建议）
- 社区经验基线 **30-100 行**
- 指令预算：Claude Code 系统提示占 ~50 条，用户可用 100-150 条
- 删除测试（Anthropic 原句）：*"删掉这行 Claude 会犯错吗？"* 否 → 删

何时拆：行数 > 200 / 覆盖多个不相关主题 / 规则反复被忽视 / 团队不断往里塞内容。

拆到哪：
- 无条件通用规则 → 根 CLAUDE.md
- 按文件路径生效 → `.claude/rules/{domain}.md` + `paths:` frontmatter
- 跨项目个人偏好 → `~/.claude/CLAUDE.md`
- 本机私有 → `./CLAUDE.local.md`（gitignore）
- 多步流程或长参考 → skill（body 不占启动 token）
- 必须强制执行 → hook

误区：`@import` **不减少 token**（全量加载），真省 token 的只有 hooks / skills body / path-scoped rules / subagents。

## 2. 措辞

强调金字塔（从高到低）：
- `IMPORTANT` / `YOU MUST` / `NEVER` / `ALWAYS`（≤ 5 条）
- `DO NOT` / `MUST`
- `SHOULD` / `AVOID`
- 普通陈述

命令式 > 假设性：禁 `try / consider / maybe / might / could / 建议 / 可考虑`。
- ❌ `Try to keep functions clean and readable`
- ✅ `Max function length: 40 lines. No nested ternaries.`

正向 > 负向（docat 关键洞察：否定句激活被否定概念）：
- ❌ `Do NOT use default exports`
- ✅ `Use named exports exclusively`
- 例外：NEVER 安全红线仍用负向。

明确性 > 抽象：形容词 → 数字；抽象 → 具体路径。

## 3. 结构（信息金字塔）

首尾效应：
- **首 5 行**：最不能违反的 3 条绝对规则
- **中间 70%**：支持细节、代码约定、工作流
- **末尾 3-5 行**：**重复**首部的绝对规则（双倍权重）

标准章节顺序：
1. 绝对规则（NEVER / ALWAYS，≤ 3 条）
2. 项目一行摘要（技术栈 + 部署目标）
3. 快速命令（dev / test / build / lint / migrate）
4. 代码风格（命名、格式、导入）
5. 约定与工作流
6. 保护区（不可改的文件/目录）
7. 重复绝对规则

MECE：每条规则只在一个分类下（除末尾重复）。

## 4. 指令完整性

每条规则必含三要素：
- **行为**：做什么 / 不做什么（具体可验证）
- **范围**：什么场景适用（文件路径、任务类型、条件）
- **失败模式**：无法执行时怎么办（停下询问 / 生成 TODO / 报错）

- ❌ `Always generate unit tests for new functions`
- ✅ `For new functions in src/: generate unit tests in __tests__/. If approach unclear, generate stub with TODO and stop.`

Scope：无 scope 的规则会跨上下文误用。写法：
- 在标题/正文里写清适用目录
- 用 YAML `paths: ["src/api/**/*.ts"]` 放 rules 文件 frontmatter

冲突审查：`grep -rE "always|never" .claude/` 找重复主题。

## 5. 排版元素

- 标题只用 `##` / `###`，禁装饰符号和 emoji
- 列表 > 段落（规则要扫描友好）
- 所有命令/配置用代码块 fence（` ```bash / ```json `）
- 代码块内的注释**保留**到上下文；块外 `<!-- -->` 被剥离
- Callout 克制：`[!IMPORTANT]` / `[!WARNING]` / `[!NOTE]` 每节 ≤ 2 个
- `---` 只用于章节性质显著跳跃，不用于每个 `##` 前后

## 6. 反模式（九类）

- **6.1 冲突指令**：同行为被不同规则约束 → 合并或 `paths:` 分离
- **6.2 过度冗长**：> 200 行，重要规则被埋 → 删除测试
- **6.3 位置不当**：核心禁令在第 150 行 → 上移 + 末尾重复
- **6.4 Vague Constraints**：`clean / readable / good` 类 → 换数字或可验证标准
- **6.5 No Failure Mode**：Claude 遇阻即瞎编 → 每条附 `If X unclear: do Y and stop`
- **6.6 No Scope**：规则跨目录误用 → 加 `paths:` 或目录限定
- **6.7 Kitchen Sink**：塞项目介绍/部署文档/环境变量 → 挪走（README / settings.json / docs/）
- **6.8 Fighting the Model**：`Never explain / Never ask` → 重定向而非压制
- **6.9 Over-specified Code Style**：prettier 级细节 → 迁 formatter + PostWrite hook

## 7. 进阶技巧

- **Anchor Comments**：`AIDEV-NOTE:` / `AIDEV-TODO:` / `AIDEV-QUESTION:` 在代码内嵌局部锚点。全大写前缀 + ≤ 120 字符 + 禁止删除现有。
- **Golden Rule**：`When unsure, ASK before changing code.`（最高优先级单条规则，兜底模糊场景）
- **AI may / MUST NOT 对照表**：比分散 NEVER/ALWAYS 更强结构
- **规模 Gate**：`> 300 LOC or > 3 files → ASK before starting`（prompt 层软 gate）
- **TODO 优先级**：`TODO(0-4)` + `PERF:`

## 8. 迭代策略

三种载体边界：
- **CLAUDE.md** — 建议性，常驻上下文，忽视率随长度上升
- **Hook** — 强制性，零上下文成本
- **Skill** — 按需加载，body 只在触发时进入上下文

判定：**Claude 被提醒过 3 次仍犯错 → 迁 hook**。

迭代路径：
- 反向更新：Claude 犯错 → 加规则防下次
- 正向审查：定期对每行做删除测试
- 载体升级：rules 犯错 3 次 → hook；长引用 → skill；跨项目偏好 → `~/.claude/CLAUDE.md`

验证 > 规则（核心）：给 Claude 验证工作的方法（tests / linter / screenshots）比任何规则都有效。
