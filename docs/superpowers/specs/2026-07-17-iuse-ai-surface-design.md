# iuse AI 友好面 — Design

让在目标项目里工作的 AI 能自主抉择「是否/如何使用 iuse」：发现（profiles）、
预演（dry-run）、机读（--json）、自述（help）、采用指引（skill）。
对照本仓 tooling rule 的挑 CLI 三标准（`--help` 完善、支持 `--json`、幂等）——
iuse 当前只达标幂等，本设计补齐前两项。

## Problem

- AI 无从发现有哪些 profile 可选（信息只在中心仓 profiles.json 里）
- init/update 没有预演：AI 只能真跑一次才知道会发生什么，抉择成本高
- 输出全是人读文本，无结构化通道；help 只有一句话描述
- ctx-init skill 与 iuse 功能重叠（终审遗留裁决），且没有任何资产教 AI
  「什么场景该用 iuse」

## Decisions

1. **`iuse profiles [--source <s>] [--json]`**（新查询命令）——列出中心源
   全部 profile：名、description、rules 清单与数量。文本输出一行一个
   `<name>  <count> rules  <description>` + 缩进 rule 名；--json 输出
   `{ profiles: [{ name, description, rules }] }`。退出码恒 0（源解析
   失败除外）。

2. **`--dry-run`（init 与 update）**——打印将发生的动作，零写入：
   - init：拼装计划逐条 `copy <rule> -> .claude/rules/<rule>.md`、
     `copy settings -> .claude/settings.json`（或 skip 原因）、
     `instantiate <template> -> <目标>`、`write lock`；composition 违规
     照常拒绝（预演也要暴露违规）
   - update：逐 rule `apply/skip(modified)/skip(missing)/add/drop(removed)`
     与原因，模板不参与
   - 实现约束：dry-run 与真实执行共享同一计划构造（planAssembly、
     drift 判定），执行函数拆「算计划」与「执行计划」两段，dry-run 只走
     前段——预演与实际永不漂移
   - 退出码：预演成功恒 0（违规/源错误仍非零）；--json 输出计划结构

3. **全命令 `--json`**——status（rows + exitCode 语义字段）、init/update
   （`{ ok, message, actions?: [...] }`）、profiles。文本形态保持不变；
   JSON 一律单行对象写 stdout，错误信息进 `message` 字段而非 stderr 裸文本。

4. **help 完善**——citty 各命令 description 扩为「一句定位 + 何时用 +
   退出码语义」；顶层 `iuse --help` 描述写明工具定位（从 infra-ai 中心源
   按 profile 拼装 Claude 配置）与典型流程
   （profiles → init --dry-run → init → status/update）。help 文本以
   中文为主（2026-07-18 用户裁决，推翻初版的英文决定）；命令名、flag、
   状态词（synced/modified/...）、退出码与术语保留英文。

5. **ctx-init skill 改写为 iuse 指路 skill**（了结终审遗留裁决）——
   元指令重写：description 触发「初始化/配置 Claude 项目」场景不变；
   正文改为 AI 决策流：探测 `iuse`（`which iuse`）→ `iuse profiles` 选型
   （拿不准问用户，不自造组合）→ `iuse init --dry-run` 预演并向用户
   复述计划 → `iuse init`；iuse 不可用时降级为手动流程（从中心源拷
   profile 内 rules + 参照 templates 实例化）。skill 名保持 ctx-init
   （账不变，语义仍是「初始化项目上下文」）。

## Testing

- profiles/dry-run/--json 各命令：core 纯函数单测（计划构造、JSON 形状）
  + CLI 层文本/JSON 双通道断言；dry-run 断言目标目录零变化
- 「算计划/执行计划」重构后既有 48 测试必须全绿（行为不变）
- ctx-init 走 imeta 重建流程；真实冒烟补一段：`profiles` + `init --dry-run`
  + `--json` 各跑一次

## Error Handling

- dry-run 下源解析失败/违规与真实执行同样报错同样退出码（预演不吞错）
- --json 模式下失败输出 `{ ok: false, message }` 到 stdout，退出码不变

## Non-Goals

- 交互式向导 / TUI（AI 与人都走命令式）
- profile 推荐算法（选型判断归 AI/人，工具只供事实）
- status --json 之外的 watch/轮询
- 回流通路（iuse diff/promote，另行立项）
