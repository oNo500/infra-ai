# 确定性校验替代 AI 语义 — Design

审计结论落地：凡判定条件能写成谓词的检查，从「依赖 AI 自觉/无人校验」
改为代码强制。AI 只保留判据本身模糊的工作（生成内容、语义对账）。

## Problem

八处判据明确的检查目前没有代码兜底：skill 上游查重靠构建时 AI 记得做；
rule/template 产物的 frontmatter/占位符契约零校验（kinds 的 verifyArtifact
是空实现）；writeback 空跑或改坏 frontmatter 无检测；元指令 `target` 字段
是从未被读的死声明；skills.json 无 schema 校验（mirror 缺字段深处才炸）；
构建沙箱之外没有第二道改动集防线；prompt 流程词红线只是一次性 grep。

## Decisions

1. **skill 上游查重前置代码化，撤销 AI 的查重职责与 ungh 授权**：
   - `KindDef` 增加可选 `preBuildCheck(fetchJson, asset): Promise<string | null>`
     （参数结构化传入，kinds.ts 不 import actions 避免循环依赖）；
     skill 实现为：`fetchJson('https://ungh.cc/repos/anthropics/claude-plugins-official/files/main')`
     取文件树，任一 path 匹配 `plugins/*/skills/<name>/` 或
     `external_plugins/<name>/` 即 fail（消息建议记 official）
   - `ActionContext` 增加 `fetchJson(url: string): Promise<unknown>`
     （默认 fetch 实现，测试注入）
   - `buildOne` 在 spawn claude 之前执行 preBuildCheck
   - `meta/prompts/skill-build.md` 删除 AI 的查重步骤（说明外壳已前置比对
     同名）；skill 的 `extraAllowedTools` 回空——沙箱收紧到与 rule/template
     一致；「同用途不同名」的语义查重放弃（Non-goal）

2. **rule 的 `verifyArtifact`**：scoped 产物必须有 `paths` frontmatter 且
   glob 与元指令 `scope` 一致；global 产物必须没有 `paths`。
   `verifyArtifact` 签名扩为 `(repoRoot, asset: { name; artifactPath; scope })`。

3. **template 的 `verifyArtifact`**：产物必须含至少一个 `[ALL_CAPS]` 占位符
   （`/\[[A-Z][A-Z0-9_]*\]/u`）。

4. **writeback 有效性校验**（writeback 动作收尾，代码）：
   - 执行前记录元指令 hash；claude 成功返回后 hash 未变 → fail
     （AI 空跑，避免状态卡 dirty 且用户不知情）
   - 前后 frontmatter 逐字段对比：除 rule 的 `scope` 外任何字段变化 → fail

5. **删除元指令 `target` 字段**：类别由目录决定（SSoT），`target` 从未被
   代码读取。五份现有元指令删除该行；`meta/README.md` 格式说明同步；
   解析对残留 `target` 宽容忽略（不报错）。

6. **skills.json schema 校验**：`loadSkills` 校验每条 `name` 为非空 string、
   `source` 属枚举；`mirror` 必有 `repo`/`path`/`commit`，缺失抛
   `RegistryError`（含条目名）。

7. **构建改动集第二防线**：`buildOne` 在 spawn 前后各取
   `git status --porcelain` 快照（经 `ctx.run`），新增/变更条目必须落在
   该类 `writableGlob` 前缀内，越界 → fail（报告越界文件，不自动回滚）。
   allowedTools 沙箱之外的独立确定性防线。

8. **prompt 红线固化为测试**：新增测试读 `meta/prompts/*.md`，断言不含
   精确流程短语（`上账`、`imeta `、`TUI`、`make `、`对 Claude 说`）；
   吸取「触发」误报教训，只用精确短语不用宽泛词。

## Testing

- 谓词逐条单测（temp 仓库 fixture）：rule scoped/global 的 paths 四象限、
  template 占位符有/无、writeback 空跑与 frontmatter 破坏两路（fake claude
  改/不改元指令）、preBuildCheck 命中/未命中（注入 fetchJson fake）、
  skills.json 缺字段、改动集越界（注入 run fake 返回构造的 porcelain 输出）
- 既有测试跟随签名扩展同步（verifyArtifact 增参）

## Error Handling

- `fetchJson` 网络失败：preBuildCheck fail 并提示（不静默跳过——查重是
  构建门槛；离线场景可日后加 `--offline` 逃生口，本期不做）
- 改动集防线的 git 命令失败：fail 并报告（防线失效不得静默）

## Non-Goals

- 「正文中文为主」的语言比例检查（heuristic 误报，留 AI + 人工抽查）
- 「同用途不同名」的上游语义查重（随 Decision 1 放弃）
- rule 精简度/姿态化的自动判定（真语义）
- 越界改动的自动回滚（只报告）
