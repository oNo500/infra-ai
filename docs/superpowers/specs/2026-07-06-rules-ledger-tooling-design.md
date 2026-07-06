# Rules 账与工具 — Design

裁决「rules 是否需要仿 skills.json 建 rules.json」，并给出「驱动工具」需求的落地方式。

## Problem

skills.json 作为显式账成立的前提是：skill 的实体与来源分离——mirror 要记
repo/commit、official 要记安装来源，这些事实不存在于 SKILL.md 内。
rules 不满足这个前提：全部 custom，来源都在 `meta/rules/`，
name/status/scope 已写在元指令 frontmatter 里。若手写 rules.json，
同一事实两处维护，违反 SSoT；若生成 rules.json，当前又没有机读索引的消费方。

原始需求是「驱动工具」：像 `make list` 读 skills.json 那样，
一眼看清每条 rule 的状态与产物对账情况。

## Decisions

1. **不建 rules.json，删除未跟踪的草稿**——按「目录即账、按需升级」：
   - `meta/rules/` 目录即账（源）：rule 的存在与状态以文件和 frontmatter
     （`name/target/status/scope`）为准
   - `rules/global|scoped/` 目录即账（产物）：产物存在与否直接看目录

2. **升级条件**——出现外部来源的 rule（需要记 repo/commit/安装方式）时，
   才升级为显式 rules.json，与 skills.json 当初的升级理由一致。

3. **工具：`scripts/list-rules.sh` + `make list-rules`**——直接扫目录与
   frontmatter，不落中间 JSON：
   - 扫 `meta/rules/*.md` frontmatter，输出 name、status（stub/ready）、
     scope（global 或 glob）
   - 按 scope 推算产物落点（`rules/global/` 或 `rules/scoped/`），
     对账标注已构建/未构建
   - 不列 `.claude/rules/` 自用文件——不在分发体系内，无对账价值

4. **不做**：任何 JSON 中间层；构建/分发脚本（构建仍是对 Claude 说
   「构建 `meta/rules/<name>.md`」，分发仍是手动 copy，见 `meta/build/rule.md`）。
