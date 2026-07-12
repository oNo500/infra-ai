# Skills

## SSoT

`skills.json`（仓库根）是全部 skill 的清单：一个 skill 是否存在、来自哪里、如何安装，以它为准。每条按 `source` 分三类：

- `custom` — 自建。内容源是 `meta/skills/<name>.md` 元指令，`skills/<name>/` 是构建产物，可重新构建。字段只有 `name`
- `mirror` — 上游有可用 SKILL.md 但不符合 skills.sh 标准，giget 拉单目录到 `skills/<name>/`。字段 `repo`、`path`、`commit`、`updated`
- `official` — 符合 skills.sh 标准，不入仓，只记 `repo`；同时是 Anthropic 官方插件的另带 `plugin`

清单记目标态，允许比实装超前：`custom` 条目可以先于产物存在。`imeta` 的 `s` 视图查全量（ledger、mirror、已安装、推荐）。

## 创建

- `custom`：在 `meta/skills/<name>.md` 写元指令，让 Claude 构建。元指令格式、构建规则、回写纪律见 [`meta/build/skill.md`](meta/build/skill.md)
- `mirror`：往 `skills.json` 加条目（`name`/`repo`/`path`），在 `imeta` 的 `s` 视图按 `u` 拉取
- `official`：往 `skills.json` 加条目（`name`/`repo`），无实体

## 维护

`imeta` 打开 TUI，`s` 进 skills 视图：进入即核对 ledger 与 mirror 上游差异，`f` 补账 unledgered，`u` 更新过期 mirror。

- 改 `custom`：意图变更先改元指令再重建；直接改了产物就回写元指令
- mirror 更新后 `skills/<name>/` 为空：上游目录挪了，用 `gh` 查 SKILL.md 新位置，更新 `path` 重拉
- mirror 被 skills.sh 收录：条目改 `official`，删 `skills/<name>/`
- 退役：删产物目录，并手动删清单条目（对账只增不删）

mirror 更新后自行 review 再提交：`git diff skills/ && git add skills/ skills.json`。

## 使用

```bash
pnpx skills add oNo500/infra-ai -s <name>   # custom/mirror 装单个
pnpx skills add oNo500/infra-ai --all       # 仓内持有的全装
pnpx skills add <owner>/<repo> -s <name>    # official 直装上游
pnpx skills update                          # 全部更新
```

official 不经本仓分发；带 `plugin` 字段的另可 `claude plugin install <plugin>`。
不发布到 skills.sh 注册表。

## 分组分发（待用）

仓库根放 `.claude-plugin/marketplace.json` 可把仓内 skill 声明成命名分组，
`pnpx skills` 按组安装一批；声明的 skill 路径在其声明深度直接搜，不受默认
depth-2 遍历限制。schema 要点：`metadata.pluginRoot`（plugin 源目录根）+
`plugins[]` 的 `name`（分组名）/`source`（源目录）/`skills[]`（skill 路径数组）。

- 引入时机：仓内 skill 多到按用途分组比逐个安装省事时；当前实体只有 drawio，不引入
- 引入方式：`skills.json` 条目加 `group` 字段，注册表加 manifest 生成动作
  （从清单生成 marketplace.json，避免两处手写漂移）；`official` 不入 manifest（不在仓内）

来源：[vercel-labs/skills](https://github.com/vercel-labs/skills) README
「Plugin Manifest Discovery」一节（核对版本 `skills@1.5.11`）；schema 与
[Claude Code plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces) 兼容。
