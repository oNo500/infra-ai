# meta-cli 运行可观测性 — Design

mutation 动作的执行过程逐步落 JSONL 日志，便于排查 headless claude 构建这类
黑盒行为。观测是横切层：业务 execute 保持纯净，插桩在统一执行入口。

## Problem

`imeta build` 内部是 claude 子进程，出问题时只有终端上滚过的文本，
tool_use 调用、prompt、退出详情都不可追溯。其它 mutation（adopt、skills:update）
失败后同样无现场。

## Decisions

1. **范围**——全部 mutation 动作记录；query 类不记（无副作用无排查价值）。

2. **深度**——claude 的原始 stream-json 事件逐行透传入日志（含 tool_use 与参数），
   不只存提取后的文本。

3. **落盘**——`.imeta/logs/<时间戳>-<action>-<对象>.jsonl`（action id 的 `:` 换 `-`，
   批量对象为 `stale`/`all`）；`.imeta/` git-ignored；创建时按 mtime 清理，
   只留最近 50 个文件，清理失败不阻塞动作。

4. **写入层用 pino**（library-first；方案 C——OpenTelemetry spans——为将来接观测
   平台的后备升级路径，本地阶段不引入）：
   - `pino.destination({ sync: true })` 直连文件——CLI 短命进程，
     不用 transport/worker（Bun 兼容与退出丢尾风险）
   - `base` 绑定 `{ runId, action }`，禁用 pid/hostname

5. **事件模型**——每行一条，`step` 字段区分：
   `start`（params）、`claude:spawn`（prompt + allowedTools）、
   `claude:event`（原始 stream-json 对象）、`claude:exit`（code/timedOut/stderr 尾部）、
   `verify`/`record`（build 链中间步骤）、`text`（终端显示过的文本）、
   `result`（ok/message/exitCode）、`error`（异常）。
   `text` 与 `claude:event` 有意冗余：「用户看到的」与「实际发生的」两条线。

6. **插桩点**：
   - 新增 `src/core/run-log.ts`：`createRunLog(repoRoot, actionId, params)` →
     `{ path, event(step, data), close() }`，创建时执行 retention 清理
   - 新增统一执行入口 `runAction(ctx, id, params, hooks)`（actions.ts 导出）：
     query 直通 execute；mutation 建 run log、包装 `hooks.onText`（记 text）与
     `ctx.claude`（记 spawn/event/exit）、执行后记 result/error，
     返回 `ActionResult & { logPath?: string }`
   - `runClaude` 加可选 `onEvent(raw)` 钩子，透传解析后的原始事件对象
   - `ActionHooks` 加可选 `onStep(step, data)`，`buildOne` 在 verify/record 后调用
   - TUI 与 CLI 一律改调 `runAction`，不再直接 `getAction().execute`
     （parity 测试不受影响——注册表与键位表不变）

7. **排查入口**——失败时 CLI 在 stderr 追加 `log: <path>`，TUI RunPanel
   失败时显示同样路径；成功不打扰。人读用 `pino-pretty`（devDependency）或 jq。

## Testing

- `tests/run-log.test.ts` — 文件生成、事件行结构（含 runId/action 绑定）、
  retention 只留 N 个
- `tests/actions.test.ts` 增补 — 经 `runAction` 跑 mutation（fake claude 发假事件）：
  日志含 claude:spawn/claude:event/verify/record/result；失败路径含 error 与
  logPath 返回；query 经 runAction 不产日志
- 既有测试不动

## Error Handling

- 日志写入失败不得影响动作本身：event() 内部吞错（记入 stderr 一次性警告）
- retention 清理失败静默跳过

## Non-Goals

- query 动作记录
- 日志查询子命令（`imeta logs` 之类，翻文件/jq 够用）
- OpenTelemetry / 观测平台接入（后备路径，触发条件：需要跨机器汇聚或关联分析）
