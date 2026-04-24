# 审查模式工作流

> 当 SKILL.md 路由到审查模式时，按本文件执行。

## 适用输入

- 用户指向一个文件路径：`./CLAUDE.md`、`./AGENTS.md`、`.claude/CLAUDE.md`、`.claude/rules/*.md`、`~/.claude/CLAUDE.md`
- 用户贴出整份文件内容
- 用户说"审一下这个项目的 CLAUDE.md"但没给路径 → 默认顺序读：`./CLAUDE.md` → `./AGENTS.md` → `.claude/CLAUDE.md`

如果路径没命中，停下问用户具体要审哪份。

## 步骤

### 步骤 1：定位 + 收集

- 用 Read 读目标文件全文
- 用 Bash 并行收集指标：
  - `wc -l <file>` — 行数
  - `grep -cE "^- NEVER|^- ALWAYS|^- IMPORTANT" <file>` — 绝对规则计数
  - `grep -iE "try|consider|maybe|might|could|建议|可考虑" <file>` — 模糊词命中
  - `grep -iE "clean|readable|good|nice|appropriate" <file>` — 形容词污染
  - `grep -rE "^- (NEVER|ALWAYS|MUST)" <file>` — 提取所有强规则行

### 步骤 2：读 checklist

加载 `references/checklist.md`，对目标文件逐项过 A-F。

### 步骤 3：对照实例

对目标文件的以下段做密度对照：

- **Things That Will Bite You** 段 vs `assets/examples/bite-you-samples.md`
- **NEVER 清单** vs `assets/examples/never-samples.md`
- **Golden Rule** vs `assets/examples/golden-rule-samples.md`
- **失败处理** vs `assets/examples/failure-mode-samples.md`

对照时只读 examples 文件顶部的"精选"段（每份文件的前 20-30 行已经是提炼结果），不要读完全部。

### 步骤 4：生成报告

按 `checklist.md` §输出格式 模板产出。报告里：

- **总评评级** 用 checklist §G 的四级（骨架期 / 试用期 / 稳定期 / 超重）
- **清单打分** 每项一行，`✓/△/✗` + ≤ 20 字说明
- **反模式清单** 只列命中的，不命中的不提
- **改写建议** 最多 10 条。每条含：
  - 一行描述
  - 理由（指向 principles.md 的哪条 / checklist.md 的哪项）
  - Before/After 代码块
- **载体升级建议** 按 checklist §F 输出

报告不超过 1 屏半（~50-80 行）。超长了就砍建议数量，核心 5 条即可。

### 步骤 5：交付

将报告整篇输出给用户。**结束前问一句**：

> "以上是审查结论。要不要把改写建议逐条应用到文件？应用时我每条都会再问一次确认。"

如果用户说"应用"：
- 进入逐条确认循环
- 每条建议：显示 before/after → 问 "apply / skip / edit" → 按回复动作
- 全部处理完 → 建议用户在 git 里看 diff 再决定是否 commit

如果用户说"不用"或没回 → 结束，不动文件。

## 禁做

- 不在用户没明确说"应用"之前改文件
- 不一次应用所有建议（必须逐条确认）
- 不自动 git commit（让用户自己看 diff）
- 不把报告写到磁盘（直接输出到对话）
