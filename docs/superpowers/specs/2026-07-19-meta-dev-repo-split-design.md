# meta 开发仓拆分与 publish 发布设计

日期：2026-07-19。用户裁决：资产管理迁出 infra-ai，开发在本地新仓，
验证之后发布回 infra-ai。

## 两仓模型

- `~/code/meta`（新仓，fresh git，历史留在 infra-ai）：开发源。
  建资产、构建、验证在此闭环（imeta status/preview、三包测试）。持有：
  - `meta/` — 元指令 + prompts + tags.json
  - `packages/` — meta-cli、iuse、preview 工具链（全局 imeta/iuse 改由此仓
    `pnpm link --global` 提供）
  - 编辑账原本 — skills.json、profiles.json、globals.json
  - `artifacts.lock.json` — 构建登记，纯开发侧，不发布
  - 构建产物工作副本 — rules/、skills/、templates/、catalog.json
- `infra-ai`（现仓）：发布面。只接收 publish 落位的产物与账，
  下游入口不变（`pnpx skills add oNo500/infra-ai`、iuse 缺省源
  `~/code/infra-ai`）。旧仓内 meta/、packages/、artifacts.lock.json 本次
  不动，清理留待后续单独裁决。

## imeta publish

- 动作注册表新增 `publish`（mutation，run log 留痕；TUI 加键位过 parity）
- 用法：`imeta publish [name...]`，缺省全部资产
- 前置校验（「验证之后」的机制化）：
  - 目标仓存在且为 infra-ai 形态（有 profiles.json）；缺省
    `~/code/infra-ai`，`IMETA_PUBLISH_TARGET` 覆盖
  - 所有待发资产 reconcile 状态必须 synced；stub/unbuilt/untracked/dirty/
    stale 拒发并点名
  - 发布前重建 catalog.json
- 落位内容：
  - 产物：rule/template 单文件（rules/<name>.md、templates/<name>.md），
    custom/mirror skill 整目录（skills/<name>/**）；official skill 不落仓
  - 账：catalog.json、profiles.json、globals.json、skills.json
- 不代提交：落位后输出发布仓 `git status --porcelain` 摘要，人审 diff
  后手动 commit/push（工具落位、人拍板，与全局层裁决同一姿态）
- 开发期试装：`iuse --source ~/code/meta`；发布后下游走缺省源

## 迁移步骤

1. `~/code/meta` init + copy（meta/、packages/、三本编辑账、lock、
   产物目录、catalog、根配置精简版 CLAUDE.md/.claude），首 commit
2. 新仓 pnpm install，meta-cli 与 iuse 重新 `pnpm link --global`，
   三包测试全绿
3. TDD 实现 publish 动作
4. 首次 `imeta publish` 到 infra-ai：预期零 diff（此刻两边产物一致），
   作为闭环验证
5. 旧仓不动；README/SKILLS.md 等使用文档随后续发布波次自然更新

## 不做（MVP 边界）

- 旧仓 meta/、packages/、lock 的移除 — 后续单独裁决
- publish 的远端推送/自动 commit — 人工提交
- git subtree/submodule 同步 — 已否决（耦合与历史纠缠）
