---
name: markdown
status: ready
scope: "**/*.md"
---

# 元指令：markdown rule

markdown 文档的写作与排版约定，作用于 `**/*.md`。

## 目标

收编原全局 `~/.claude/rules/markdown.md`，并入 notes 仓 PKM 写作规范中
可移植（不绑 Obsidian）的部分与术语纪律。AI slop、自造词的禁令已在
constitution，本 rule 不重复展开，只落写作层面的具体约定。

## 约束（素材，构建时组织成产物）

结构：

- 标题树按 MECE 组织：兄弟节互斥、并集穷尽；「其他」类内容超过两成
  说明分类失败
- 仅一个 H1（文件标题）；标题不跳级（H2 → H4 是错误）
- 重要信息前置，不写导览语（「下面我们将介绍…」）
- 密集信息用列表不用长段落；不使用表格，用列表替代（无条件，无豁免）
- 一篇一主题，命中两个主题就拆分

格式：

- 代码块必须带语言标签；前后对比用 `diff` fence
- `**bold**` 不用 `__bold__`；`*italic*` 不用 `_italic_`；
  命令、路径、标识、值用行内 code
- `---` 只用于重大分节，不夹在标题之间当装饰
- GFM alerts 每篇 0-2 个，只给关键边界提醒，不当装饰；
  面向 AI 阅读的规则文档不用 alerts
- `<details>` 收纳会打断阅读流的长参考内容

图示：

- 表达架构、流程、关系优先 Mermaid
- 结构化 ASCII（目录树、状态机、拓扑）信息密度高，可用；
  装饰性 ASCII（花框、分隔线、ASCII art）禁止

术语（ISO 704 路径）：

- 概念先行：先明确概念，再找行业标准词直接采用；不确定时停下查证
- 一概一词：同一概念在一篇文档内不换词（不「聚合/聚合体/聚合对象」混用）
- 中英锚定只在首次出现：`aggregate（聚合）`，此后统一用一种形式
- 工程语境惯用的英文术语保留原词不强译（`idempotent`、`debounce`），
  不造半英半中词
- 约束用「约定」，描述现状用「结构」——目录树写「目录约定」才构成约束

## 产物要求

- scoped 落点；alerts、details、Mermaid 各给一个最小语法示例，
  其余约定一行说清即可
- 素材源：原 `~/.claude/rules/markdown.md`、notes 仓
  `20-areas/20-06-学习与成长/写作-PKM写作规范.md`、
  `10-projects/10-06-boilerplate/AI-AGENTS写作标准.md` §4.2/§5
