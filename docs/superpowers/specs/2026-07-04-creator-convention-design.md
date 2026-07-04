# Creator 执行约定与账目对账 — Design

给 `creator/` 里的元指令补一套执行约定，并用脚本保证 `skills.json` 上账不再靠自觉。

## Problem

`creator/` 已有 4 条元指令（描述要创建的 skill / rule），但没有执行它们的约定：
怎么触发、产物落到哪、执行完怎么标记，都没有定义。其中 `commit-lite.md` 自带的
输出路径（`~/.claude/skills/`）与仓库模型（自建 skill 进 `skills/` 并记入
`skills.json`）冲突。同时，上账没有任何机制保证——漏记一次，账实就漂移。

## Constraints

- 不依赖 `.claude/`（settings.json、Claude hooks 均不动）
- 不依赖 git hooks（不引入 `.githooks/`、`core.hooksPath`）
- 机制自包含：只用 Makefile + `scripts/`，与现有 `sync-skills.sh` 同构

## Decisions

1. **纯约定 + 脚本对账，不建 creator skill**——流程写成文档；记账的确定性
   由幂等脚本保证，不依赖流程被完整遵守
2. **产物落点仓库模型优先**——skill 产物进 `skills/<name>/SKILL.md` 并上账；
   rule 产物进 `docs/rules/<name>.md`；元指令内与此冲突的路径视为过时，执行时以约定为准
3. **执行后原地标记**——元指令 frontmatter `tags` 改 `done`，文件保留
4. **对账自愈而非阻断**——无 commit 关口；漂移最迟在下一次 `make check` 暴露，
   `make sync` 修复

## 分层架构

### 约定层 + 流程层：creator/README.md

一份文档覆盖两层：

- 目录结构：`creator/skills/*.md`、`creator/rules/*.md`，每文件一条元指令
- 元指令状态（frontmatter `tags`）：`stub`（意图占位）→ `draft`(内容完整可执行) → `done`（已执行）
- 落点与模板源：skill → `skills/<name>/`（格式参照 `templates/skill.md`）；
  rule → `docs/rules/<name>.md`（格式参照 `templates/rule.md`）
- 执行流程：读元指令 → `stub` 先与用户对齐补全为 `draft` → 生成产物到约定落点 →
  元指令标 `done` → 跑 `make sync` 完成上账
- 明确约定：自建 skill 不写 `~/.claude/skills/` 等仓库外路径

### 对账层：scripts/check-ledger.sh

两个模式，与 `sync-skills.sh check/update` 的语义对齐：

- `check`（只读）：报告差异，有差异时退出非零
- `fix`（写入）：执行修复

对账规则：

- 扫描 `skills/*/`（含 `SKILL.md` 的目录）
- 目录存在、`skills.json` 无条目 → `fix` 模式追加 `{ "name": "<dir>", "source": "custom" }`
- 已有条目（custom 或 mirror）→ 不动
- `SKILL.md` frontmatter `name` 与目录名不一致 → 两种模式都报错（此项无法自动修复）
- 不删账：账上有、目录无的条目保留（清单记目标态，允许领先实装）
- 幂等：重复执行结果一致

### Makefile 挂载

- `make check` 在现有 mirror 检查后追加 `check-ledger.sh check`
- `make sync` 在现有 mirror 拉取后追加 `check-ledger.sh fix`
- 不新增 make 目标

## 现有元指令处置

本次不修改元指令内容，仅按状态归类：

- `skills/commit-lite.md` — `draft`，可执行；执行时输出路径按约定修正为 `skills/commit-lite/`
- `rules/python.md`、`rules/typescript.md` — `stub`
- `rules/readme-rule.md` — 是 rule 内容草稿而非元指令，执行前需先整理出元指令头
  （目标、落点），暂按 `draft` 素材对待

## 根 README 联动

「内容」一节补一行：`creator/` — 待创建 skill/rule 的元指令，自用不分发。

## Out of Scope

- Claude hooks 与 git hooks（约束排除）
- 元指令 `done` 的自动标记（产物与元指令无确定性映射，机械化会误标）
- `~/.claude/` 写入护栏（无宿主机制可挂，约定层文字覆盖）

## Verification

仓内无 bash 测试设施（`sync-skills.sh` 亦无测试），用手动验证：

- 空账目录：造一个含 `SKILL.md` 的临时 skill 目录，`check` 报差异且退出非零，
  `fix` 后条目出现、再跑 `check` 通过（幂等）
- mirror 跳过：对 `drawio` 目录不产生新条目
- name 不一致：临时改 frontmatter `name`，两种模式均报错
- 目标态条目：`skills.json` 里有账无目录的 custom 条目不被删除
