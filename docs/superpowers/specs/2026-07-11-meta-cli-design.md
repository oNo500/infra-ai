# meta-cli — Design

将 meta 维护工作流（对账、构建、分发、回写）从「对 Claude 说 + bash 脚本 + 手动 copy」
改造为一个全屏 TUI CLI，构建与回写环节通过 claude CLI headless 调用完成，
消除人机对话依赖。

## Problem

当前工作流四个环节的现状：

- 对账：`scripts/*.sh` 5 个 bash 脚本（约 300 行），只读核对
- 构建：对 Claude 说「构建 `meta/<类>/<name>.md`」，依赖交互会话
- 分发：手动 copy 产物到下游项目 `.claude/rules/`，无下游登记，无漂移检测
- 回写：纯纪律约束，产物被直接改过时没有任何机制发现

规模上来后，分发漂移与回写遗漏无法靠纪律维持；构建依赖交互会话也无法批量执行。

## Scope

规划为两个 CLI：

- **meta-cli（本期）**——维护端，在 infra-ai 仓库内使用：对账、构建、分发、回写
- 使用端 CLI（后续另立项）——在下游仓库内使用：检查已装 skill/rule、初始化配置

## Decisions

1. **全屏 TUI，bun + ink**——单入口交互应用，不做子命令体系；
   可脚本化出口（如 CI 用的非交互 check）留待真实需求出现再加。

2. **构建/回写调 claude CLI headless**——spawn `claude -p`，复用已装 Claude Code
   与项目上下文（CLAUDE.md、rules 自动加载）；不引入 Agent SDK 或直连 API。

3. **分发登记 `targets.json`**——新增登记文件记录下游项目路径及其订阅的资产，
   `dist` 按登记分发，对账时检测下游副本是否落后或被改。
   分发范围限 rules（照搬型，copy 即用）；templates 需结合目标项目实例化占位符、
   skills 走 `skills add` 生态，均不是 copy 能覆盖的，见 Non-Goals。

4. **构建记录 `artifacts.lock.json`**——每次构建记录 meta 源 hash、产物 hash。
   与 2026-07-06 spec「目录即账、按需升级」不冲突：构建时刻的 hash
   是目录与 frontmatter 里不存在的事实，满足当初 skills.json 的升级条件。

5. **回写 = 漂移检测 + AI 辅助**——产物 hash 与记录不符即判定待回写；
   回写把当前元指令与产物交给 claude headless 做语义对账，
   不做「上次构建快照」的精确 diff，避免引入快照存储。

6. **包管理 pnpm，运行时 bun**——根建 `pnpm-workspace.yaml`（`packages/*`）；
   开发与测试用 bun（`bun run` / `bun test`）。

7. **脚手架借鉴 infra-code**——`bunx giget gh:oNo500/infra-code/starters/cli` 起底，
   保留 toolchain（`@infra-x/code-quality`、`@infra-x/typescript-config`、tsdown、
   bun test），替换 citty 为 ink + react。暂不发布 npm，本仓自用。

8. **吸收 bash 脚本**——`scripts/*.sh` 逻辑并入 core 后删除，
   Makefile 目标改为薄封装调 CLI。

## Architecture

```
packages/meta-cli/
├── src/
│   ├── core/          # 纯逻辑，不依赖 ink
│   │   ├── registry/  # skills.json / targets.json / artifacts.lock.json 读写
│   │   ├── meta/      # 元指令 frontmatter 解析、产物落点推算
│   │   ├── status/    # 状态判定（stub/stale/dirty/downstream-drift）
│   │   └── claude/    # claude headless 进程封装（spawn、事件流解析、校验）
│   ├── tui/           # ink 组件：视图、键位、进度渲染
│   └── index.tsx      # 入口
└── tests/             # core 纯函数测试（bun test）
```

- core 全部纯函数；fs 与 spawn 收敛在薄 IO 层，供测试替换
- tui 只做展示与输入，动作全部调 core
- 将来使用端 CLI 立项时，共享逻辑提升为 `packages/core`

## Data Model

三个登记文件（均在仓库根）：

- `skills.json`——既有，skill 存在与来源，不改动格式
- `targets.json`——新增：`[{ path, subscriptions: [<rule>...] }]`，
  下游项目绝对路径及订阅的 rules
- `artifacts.lock.json`——新增：`{ <asset>: { metaHash, artifactHash, builtAt } }`

状态判定（TUI 状态列的唯一事实来源）：

- **stub**——meta frontmatter `status: stub`；禁止构建（原流程中 stub 靠对话对齐，
  headless 无法对齐，须先人工补全为 ready）
- **stale**——meta 源 hash ≠ 记录值：元指令改了，产物待重建
- **dirty**——产物 hash ≠ 记录值：产物被直接改过，待回写；
  回写完成后元指令变化触发 stale，重建后闭环
- **downstream-drift**——下游副本内容 ≠ 本仓产物：待重新分发

## TUI

两个视图，启动进资产总览：

- **资产总览**——全部 meta 资产：名称、类别（rule/skill/template）、
  meta 状态、对账状态；`Enter` 详情（路径、hash 明细、订阅方）
  - `b` 构建选中（stub 置灰）；`w` 回写 dirty；`d` 分发到订阅方
  - `B` 批量构建全部 stale；`D` 批量分发全部 downstream-drift
- **targets 管理**（`t` 切换）——下游项目及订阅的增删，订阅项从 rule 产物清单勾选
- 构建/回写运行中：右侧面板实时渲染 claude 事件流；完成后就地刷新状态；
  `q` 退出，有运行中任务时二次确认

## Claude Headless

core 提供 `runClaude(prompt, opts)`，构建与回写共用：

- `claude -p <prompt> --output-format stream-json --verbose`，cwd 为仓库根
- `--allowedTools` 白名单：读任意；写仅限目标落点（构建：`rules/`、`skills/`、
  `templates/`；回写：对应 `meta/` 文件）；不给 Bash
- build prompt：「构建 `meta/<类>/<name>.md`，遵循 `meta/build/<类>.md`」——
  复用现有构建规则文件，不另造 prompt 体系
- writeback prompt：给出元指令与产物路径，要求将产物中元指令未覆盖的内容
  回写进元指令正文
- 完成后校验：目标文件存在、frontmatter 可解析、落点正确；
  通过才更新 `artifacts.lock.json`，失败保留现场报错
- 超时默认 5 分钟；超时或非零退出终止进程，TUI 展示 stderr 尾部

## Error Handling & Testing

- 登记文件 JSON 解析失败：启动时报错退出，不带病运行
- 登记文件写入原子化：写临时文件后 rename
- core 纯函数 `bun test` 覆盖；TUI 组件 MVP 阶段不做自动化测试

## Non-Goals

- 使用端 CLI（另立项）
- templates 分发（需实例化占位符，仍走对话）与 skills 分发（走 `skills add` 生态）
- npm 发布、changesets 流程
- 非交互/CI 出口
- mirror skill 的上游同步逻辑改造（sync-skills.sh 逻辑原样并入 core）
