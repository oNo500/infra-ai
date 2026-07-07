# docs/constitution/ 收编 — Design

把 `docs/constitution/` 两个文件收编进 meta 源→产物体系，消灭体系外特例，
并引入模板型产物（`target: template`）承载「骨架通用、内容项目专属」的 rule。

## Problem

constitution 这一事实存在于三处：`docs/constitution/`（名义源）、
`.claude/rules/`（手工副本，靠人肉同步）、`~/.claude/CLAUDE.md` 英文变体（已分叉）。
`docs/constitution/` 游离在 meta 源→构建→产物模型之外，是唯一的体系外特例。

两个文件的通用性形态不同，收编路径不同：

- `constitution.md` — 内容通用，原样 copy 到任何项目都成立，是标准的照搬型 global rule
- `architecture.md` — 骨架通用、内容项目专属：「每个项目该有一份描述自己结构的
  architecture rule」这个形态通用，但正文必须按项目实例化。
  `meta/rules/readme-rule.md` stub 的正文（带 `[PROJECT_NAME]` 占位符的
  architecture 模板草稿）就是这个需求的雏形

## Decisions

1. **constitution 走照搬型**——新建 `meta/rules/constitution.md`
   （`target: rule`、`scope: global`、`status: ready`，内容素材即现
   `docs/constitution/constitution.md`），构建产物 `rules/global/constitution.md`。
   infra-ai 自身的 `.claude/rules/constitution.md` 文件不动，
   身份从「手工副本」变为「分发副本」，与其他项目地位相同。

2. **模板型由 `target: template` 承载，不加新字段**——产物类型本由 `target`
   表达（`rule` → `rules/`），元指令目录按 target 分组；模板型是该语义的直接延伸：
   - `meta/rules/readme-rule.md` 改名迁移为 `meta/templates/architecture.md`
     （`target: template`、`status: ready`，补全意图说明，正文素材保留）
   - 构建产物 `templates/architecture.md`，与现有 CLAUDE.md、settings.json 等模板同列
   - 新增 `meta/build/template.md` 构建规则，写清模板型的分发动作是**实例化**
     （结合目标项目填占位符后落其 `.claude/rules/`），与 rule 的 copy 分发区分
   - 由此「照搬型/模板型」的区分由产物落点（目录）承载：`rules/` 内全部 copy 即用，
     模板归 `templates/`

3. **删除 `docs/constitution/` 并更新引用**：
   - 两个文件内容分别被决策 1、2 吸收后删除整个目录
   - `README.md` 第 15 行的 `docs/constitution/` 引用改指新位置；
     按仓库规则同步检查 `README.zh.md`
   - `.claude/rules/architecture.md`（infra-ai 自用）顺带更新过时内容：
     删掉已不存在的 `skills/ctx-init`、`context-management.md`、`skills.md`
     等描述，对齐当前仓库结构

4. **本次顺带构建两个产物**——`rules/global/constitution.md` 与
   `templates/architecture.md` 内容现成，收编时一并构建，不留空账。

## Out of Scope

- `list-rules` 不扩展扫 `meta/templates/`——templates 目录即账，`ls` 可见，
  有对账需求时再升级
- `~/.claude/CLAUDE.md` 英文 Constitution 变体的收敛：待用户单独裁决
- `templates/` 下其他既有模板（CLAUDE.md、mcp.md、settings.json、skill.md、
  rule.md）不补建 meta 源——按需升级，改到谁再建谁
