# meta-cli 命令式界面 — Design

为 meta-cli 增加非交互子命令界面，与 TUI 功能同步；同步由动作注册表强制保障。
推翻 2026-07-11 meta-cli spec 中「非交互/CI 出口」的 Non-Goal：命令式的主要
消费方是 AI（会话中的 Claude 直接驱动构建/对账，不再依赖 TUI 或对话式构建）。

## Problem

TUI 是唯一入口：AI 与脚本无法非交互地触发对账、构建、分发、回写。
若为命令式单独实现一套动作，两个前端必然漂移——「保持功能同步」需要机制，
不能靠纪律。

## Decisions

1. **同一入口，无参进 TUI**——`pnpm meta` / `make meta` 无参数渲染 TUI；
   带子命令走非交互执行。单 bin，与 git/gh 惯例一致。

2. **citty 解析**——恢复 infra-code cli starter 的选型，声明式子命令与帮助文本。

3. **动作注册表 `src/core/actions.ts` 是功能同步的 SSoT**——
   - `ActionDef { id, summary, args: ArgSpec[], kind: 'query' | 'mutation', execute(ctx, params, hooks) }`
   - `ActionContext { repoRoot, run: CommandRunner, now: () => string }`；
     `ActionHooks { onText? }`（TUI 喂 RunPanel，CLI 直写 stdout）
   - `app.tsx` 现有编排逻辑（build 的 runClaude→verifyBuild→recordBuild 链、
     批量循环、adopt 的锁读写）下沉进 execute；TUI 处理器瘦身为
     「取选中行 → 调 action → 刷新」
   - query 类 execute 返回 data，渲染留给前端

4. **CLI 层由注册表生成**——`src/cli/index.ts` 遍历 `ACTIONS` 生成 citty
   subCommands；query 类挂 `--json`。新动作零成本进入命令式。

5. **TUI 键位表声明化**——`src/tui/keymap.ts`：
   条目形如 `{ actionId, view, key? }`——mutation 动作绑 `key`（在哪个视图哪个键），
   query 动作省略 `key` 表示由该视图本身承载；含子视图动作键
   （targets 的 n/x/space、skills 的 f/u）；query 动作由视图承载
   （资产列表=status、targets 视图=targets:list、skills 视图=skills:status）。
   交互流程（选中、勾选、TextInput、二次确认、运行面板）不变。

6. **parity 测试强制同步**——`tests/parity.test.ts`：
   - 注册表每个 action 在 keymap 有条目（键位或视图），漏接红灯
   - 生成的 citty 子命令名集合 == 注册表 id 集合（冒烟）

   红线同时写进 `architecture.md`：新增动作必须先进注册表，两端接齐测试才过。

7. **输出面向 AI**——确定性对齐文本；`status`、`targets list`、`skills status`
   支持 `--json`。退出码：mutation 失败退 1（stderr 报错）；`status` 存在
   dirty/stale/drift/unbuilt 时退 1（stub 不算），一个退出码判断是否需要收敛。

## 命令面

```
meta                                  # TUI
meta status [name] [--json]           # 总览/单资产详情（含下游状态）
meta adopt <name>
meta build <name...> [--stale]
meta writeback <name>
meta dist <name...> [--all]
meta targets list [--json] | add <path> | remove <path>
             | subscribe <path> <rule> | unsubscribe <path> <rule>
meta skills status [--json] | fix | update
```

注册表 id 与子命令映射：嵌套命令用 `targets:add` 形式的 id，
CLI 生成时按 `:` 拆成 citty 子命令层级。

## Testing

- `tests/actions.test.ts` — execute 单测（temp 仓库 fixture + 注入 CommandRunner），
  重点覆盖从 app.tsx 下沉的编排逻辑（build 链、批量、adopt），
  这部分原先只有人工验证
- `tests/cli.test.ts` — query 命令跑真输出断言文本/JSON 与退出码；
  mutation 命令测参数校验与失败退出码，不真调 claude
- `tests/parity.test.ts` — 见 Decision 6
- 既有 core 测试不动；TUI 组件仍不做组件测试，交互回归靠人工清单

## Error Handling

- 登记文件损坏：启动报错退出（沿用）
- CLI 下 RegistryError 与参数校验错误打 stderr、退 1
- `build`/`writeback` 的 claude 超时与非零退出：stderr 报错、退 1，
  lock 不更新（沿用 verify→record 顺序）

## Non-Goals

- TUI 交互流程改动（仅换底层调用）
- mutation 类的 --json 输出
- 使用端 CLI（仍另立项）
