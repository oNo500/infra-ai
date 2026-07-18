# iuse TUI — Design

给 iuse 加人面：完整 ink TUI（与 imeta 同栈）。裸跑 `iuse` 在 TTY 下启动
TUI 并按下游账智能分流；四个子命令保持纯命令式——TUI 是人面，
子命令是 AI/脚本面，互不侵扰。推翻 AI 友好面 spec 的「无 TUI」Non-Goal
（2026-07-18 用户裁决，形态选完整 TUI 而非向导式 prompts）。

## Problem

- 人用 iuse 的典型流程（查 profiles → 手拼 --profile → dry-run → init）
  每步都要自己敲命令；裸跑只得到 "No command specified"
- 选 profile 时看不到各组合的 rule 清单对比；执行实例化（分钟级）没有
  进度反馈

## Decisions

1. **入口分流**——`iuse` 无子命令时：`process.stdout.isTTY`（经注入可测）
   为真 → 启动 TUI；非 TTY → 维持现有 help + "No command specified"。
   带子命令一律走既有命令式路径，行为零变化。TUI 初始视图按
   `loadDownstreamLock(cwd)` 分流：无账 → Init 流；有账 → Status 视图。

2. **TUI 状态机**（ink 6 + React，依赖版本照抄 meta-cli；界面文案中文、
   状态词与命令保留英文；组件文件 kebab-case，落 `src/tui/`）：
   - Init 流三步：profile 选择器（↑↓ 移动；左列 profile 名 + 描述，
     右侧实时预览选中项 rule 清单）→ 计划预览（dry-run steps 逐行
     `op target (note)`）→ 确认（回车执行 / esc 返回选择）→ 进度视图
     （逐步骤打勾；instantiate 步显示 spinner 与「claude 实例化中，
     分钟级」提示）→ 结果（成功后转入 Status 视图）
   - Status 视图：逐 rule 行 `<rule> <state>`，语义色沿 imeta 惯例
     （synced 绿 / modified 黄 / outdated 蓝 / missing 红）；键位：
     `u` 进 update 流（计划预览 → 确认 → 执行，modified 项标注
     「默认跳过」）、`f` 在 update 预览里切换 force、`r` 刷新、`q` 退出
   - 顶栏常驻：target 路径、profile 名、source 定位符与版本标识
   - 错误（源解析失败、composition 违规、实例化失败）在当前视图内
     整块展示 message，`r` 重试、`q` 退出——不崩出 TUI

3. **架构：TUI 是薄壳，不引入动作注册表**——直接调用既有 core：
   `listProfiles`、`runInit`（dry-run 与真实）、`statusReport`、
   `runUpdate`。meta-cli 的注册表红线管的是 meta-cli 自身（其 TUI/CLI
   双端需要 parity）；iuse 的 core 函数就是单一事实源，TUI 与 CLI
   都是展示层，无第二事实源可漂移。

4. **core 唯一微改**：`runInit`/`runUpdate` 的 opts 增加可选
   `onProgress?: (step: ActionStep) => void`，执行阶段每步动手前触发；
   纯增量，既有调用方与测试零影响。dry-run 不触发 onProgress。

5. **入口文件**——bin 入口保持 `src/index.ts`，TTY 分流后动态
   `import('./tui/app')` 再渲染；非 TUI 路径不加载 ink/React
   （命令式启动开销不变）。

## Testing

- TUI 组件用 ink-testing-library：profile 选择器渲染与键位、计划预览
  渲染、状态行着色、update 流 force 切换
- 入口分流：isTTY 经参数注入，TTY/非 TTY 两态断言
- onProgress：单测断言步序与 dry-run 不触发
- 既有 73 测试全绿；真实冒烟一次 TUI 启动（PTY 下渲染出 profile 列表）

## Error Handling

- TUI 内所有 core 调用失败均以 message 块内呈现（含 stderr tail），
  不落回裸异常；非 TTY 裸跑维持现有输出
- claude 实例化失败后回到结果视图展示失败步与提示（--force 重跑语义
  由「重试」键触发带 force 的 init）

## Non-Goals

- 子命令的交互化（参数齐全的命令式路径永不 prompt）
- TUI 内浏览/编辑 rule 内容（预览只到清单级）
- profiles 编辑（组合定义归中心仓 profiles.json）
- 远程源在 TUI 内的进度细化（giget 拉取显示 spinner 即可）
