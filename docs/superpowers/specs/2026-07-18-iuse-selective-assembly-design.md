# iuse 目标级选择拼装 — Design

给拼装加目标级偏差管理：显式排除（记入下游账）、后续补回、同步时逐条
看差异并裁决覆盖/忽略。TUI 与 CLI 三皮一核对等。

## Problem

- 计划预览全有或全无：目标项目不想要 profile 里某条 rule 时没有出口
- 不记账的排除会被 status 永远报 outdated（源 profile 有而下游无）
- 同步/补回时看不到本地与源的内容差异，只能盲选跳过或 --force 全覆盖

## Decisions

1. **下游账增 `excluded?: string[]`**——目标级显式偏差的 SSoT。
   init：TUI 计划预览的 copy-rule 行变勾选列表（空格切换，取消即排除）；
   CLI `iuse init --exclude <a,b>`（逗号分隔；旗标重复时 citty 解析器
   last-wins，不支持重复形式——help 只宣传逗号形式）。排除项不拷贝、
   不进 `rules` 基线、记入 `excluded`。

2. **状态语义**——statusReport 为 excluded 的 rule 输出
   `state: 'excluded'`（DriftState 增值）；**不计入退出码漂移判定**
   （已定决策非待办）。TUI 灰色行；`--json` 照带。源 profile 新增且
   未排除的 rule 照旧报 outdated。排除后本地文件保留不删（与
   removed-rule 同一纪律：账收敛、文件人工处置）。

3. **忽略 vs 排除的语义分工**（红线级表述）——
   忽略 = 本次跳过，保留本地，下次 status 照常提醒；
   排除 = 永久闸门，不再提醒；想永远保持本地版就排除。
   不引入第三态（如「采纳本地为基线」——那会让下游宣称 synced 却偏离源，
   审计失真）。

4. **update 流升级为逐条裁决（TUI）**——
   - 计划行可导航（↑↓）；excluded 行以未勾选形态列出，空格勾选即补回
     候选（补回 = 从 excluded 移除 + 按源内容落盘 + 进 rules 基线）
   - modified 行与「补回但本地已有文件」行：回车进 diff 视图
     （行级 unified diff，+绿/-红；jsdiff 实现，Library-First）；
     视图内 `o` 覆盖（源赢）、`i` 忽略（本次保留）、esc 返回
   - 裁决累积成执行集，确认后一次执行（执行仍走 plan/execute 两段与
     onProgress）；esc 放弃全部裁决返回 status
   - CLI 对等：`iuse update --include <a,b>` 补回（本地已有且内容不同时
     默认跳过并提示 diff 命令，`--force` 覆盖）；`--force` 批量覆盖语义
     不变

5. **新查询命令 `iuse diff [--rule <name>] [--source] [--json] [target]`**
   （rule 用具名参数——与 target 双 positional 有歧义）——本地副本 vs
   源产物的 unified diff；无参数时列出全部有差异的 rule 及摘要
   （行增删计数），指定 rule 时输出完整 diff。无参数默认不含 excluded
   项（与「排除不唠叨」一致——否则源一演化就永远退 1）；指名 excluded
   rule 时照常输出（供补回决策）。退出码：有差异退 1、无差异退 0
   （与 status 的对账语义一致）；`--json` 输出
   `{ ok, diffs: [{ rule, state, additions, deletions, patch? }] }`
   （指定 rule 时含 patch 全文）。这同时是此前记档「回流通路」的
   最小实现——把差异摆给人/AI 决定带回中心还是覆盖。

6. **兼容**——旧下游账无 `excluded` 字段按空数组读；lock 写回时字段
   仅在非空时写出（账保持精简）。iuse 主 spec
   （2026-07-17-iuse-consumer-cli-design.md）的下游账 schema 与
   status 三态描述由本 spec 增补，不回改原文（叠加式演进，原 spec 加
   一行指针）。

## Testing

- core：excluded 记账/读写兼容、statusReport excluded 态与退出码、
  update 补回路径（干净补回 / 本地已有不同内容默认跳过 / force 覆盖）、
  diff 计算与 --json 形状
- TUI：计划预览勾选切换与排除落账、update 清单导航 + diff 视图 o/i 裁决
  + 执行集聚合、excluded 灰色行；沿用 ink-testing-library 与门控 fake
  惯例
- CLI：--exclude/--include 解析、diff 命令双通道；既有 90 测试全绿

## Error Handling

- --exclude 指名不在 profile 内的 rule：报错列出可选名
- --include 指名不在 excluded 的 rule：报错提示当前 excluded 清单
- diff 指名无本地副本的 rule：按「本地缺失」输出全增 diff 并标注
- TUI diff 视图对二进制/超长内容截断展示并提示用 CLI 查看

## Non-Goals

- 「采纳本地为基线」第三态（见 Decision 3）
- 模板与 settings 的 diff/裁决（实例化产物已项目化，不对账不 diff）
- 排除项的中心侧上报（下游账即完整审计面）
- 三方合并（覆盖/忽略二元裁决已够，merge 归人工编辑器）
