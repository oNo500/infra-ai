# prompts 分层与类别注册表 — Design

按「prompt 进文档、workflow 进代码、契约进注册表」重构 meta 文档层与 CLI 的
类别知识分布。核心判据：自然语言只在消费者是模型或人的地方存在，
且每份文件单一受众。

## Problem

- `meta/build/*.md` 混装两种受众的内容：AI 构建指令（生成要求、检查清单）与
  人读流程（触发方式、上账步骤、分发去向）。headless claude 把整份文件当
  prompt 读，流程部分成为噪声甚至误导（实测：构建日志显示 claude 推理
  「第 6 步上账不是我的活」、按文档残留尝试 `gh api` 被沙箱拦截）
- workflow 已有权威实现（`actions.ts` 的动作链，可测试、有 run log），
  再写流程文档就是第二事实源——本仓已多次发生文档-代码漂移并逐一修补
- 类别知识散在代码五处：`meta.ts` 的 KIND_DIR 与 `artifactPathFor` 三分支、
  `claude.ts` 的 BUILD_RULE 映射、`allowedToolsFor` 类别分支、`verifyBuild`
  的 skill 专属校验。「新增一类资产只加一个落点」的承诺实际要改五处
- `writebackPromptFor` 的行为指令硬编码在代码字符串里——prompt 内容进了代码
- `templates/` 产物区混入两份非分发品：`templates/rule.md`（决策清单）、
  `templates/skill.md`（核实步骤），实为构建 prompt 的组成部分

## Decisions

1. **文档只保留两类**：
   - `meta/prompts/<kind>-build.md` 与 `<kind>-writeback.md`（共 6 份）——
     AI 行为契约，唯一消费者是 headless claude；只写 AI 该做的
     （生成要求、检查清单、上游核实、语言、落点约束、质量标准），
     禁止出现流程步骤（触发方式、上账、外壳职责）
   - `meta/README.md`（1 份）——人读一页：元指令 frontmatter 格式、
     stub/ready 语义、新增资产流程（写元指令 + `imeta build`）

2. **workflow 的 SSoT 是代码**——`actions.ts` 动作链 + `imeta --help` +
   run log 即流程定义与文档；不设 workflow 说明文档。

3. **类别注册表 `src/core/kinds.ts`**——一类一条机器契约：

   ```ts
   interface KindDef {
     kind: AssetKind
     metaDir: string                          // meta/rules
     artifactPath(name: string, scope: string | null): string
     buildPrompt: string                      // meta/prompts/rule-build.md
     writebackPrompt: string                  // meta/prompts/rule-writeback.md
     writableGlob(name: string): string       // 构建沙箱写权限
     extraAllowedTools: string[]              // skill: ['WebFetch(domain:ungh.cc)']
     verifyArtifact(repoRoot: string, asset: MetaAsset): string | null
   }
   export const KINDS: Record<AssetKind, KindDef>
   ```

   `meta.ts`（KIND_DIR、artifactPathFor）与 `claude.ts`（BUILD_RULE、
   allowedToolsFor 类别分支、verifyBuild 的 skill 分支）改为消费注册表。
   新增一类资产 = 一条 KindDef + 两份 prompt 文档。

4. **writeback 指令进文档**——`writebackPromptFor` 退化为指针
   （「回写 `<metaPath>`，遵循 `<writebackPrompt>` 的回写规则」），
   行为内容（现 `claude.ts` 硬编码的三行）搬进 `<kind>-writeback.md`。

5. **原内容分拣**（`meta/build/*.md` 与 `templates/{rule,skill}.md` 就地退役）：
   - AI 该做的 → 对应 build prompt（含 `templates/rule.md` 决策清单、
     `templates/skill.md` 核实步骤与 frontmatter 契约整体并入）
   - 元指令格式 → `meta/README.md`
   - 流程描述（触发、上账、verify/record）→ 删除，代码已是事实
   - 分发语义与回写纪律 → 已在 `architecture.md`，不重复
   - 语言约束（中文为主术语英文）→ 各 prompt 文档保留

6. **`templates/` 产物区只留真分发模板**：CLAUDE.md、settings.json、
   architecture.md、mcp.md。

7. **引用同步**：`.claude/CLAUDE.md`、`.claude/rules/architecture.md`、
   `README.md`、`SKILLS.md` 中 `meta/build` 相关表述；`claude.ts` 测试断言。

## Testing

- `tests/kinds.test.ts`——每 kind 的契约字段（落点、prompt 路径存在于仓库、
  writableGlob、extraAllowedTools）
- 既有 `meta.test.ts`/`claude.test.ts` 断言随注册表消费改造同步
  （行为不变：落点、白名单串、prompt 指针内容更新路径）
- 收尾人工验证：真实 `imeta build commit-lite` 一次，
  run log 确认 claude 读的是新 prompt 且不再出现流程噪声推理

## Error Handling

- 注册表是编译期常量，无运行时失败面；prompt 文件缺失时构建 prompt 指针
  照发，claude Read 失败会在 run log 留痕（现有机制，不加预检）

## Non-Goals

- actions 注册表与 TUI 行为改动（仅内部消费方式变化）
- 元指令格式本身的变更
- 使用端 CLI
