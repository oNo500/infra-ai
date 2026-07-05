# Skills

## SSoT

`skills.json`（仓库根）是全部 skill 的清单：一个 skill 是否存在、来自哪里、如何安装，以它为准。每条按 `source` 分三类：

- `custom` — 自建。实体在 `skills/<name>/`，字段只有 `name`
- `mirror` — 上游有可用 SKILL.md 但不符合 skills.sh 标准，giget 拉单目录到 `skills/<name>/`。字段 `repo`、`path`、`commit`、`updated`
- `official` — 符合 skills.sh 标准，不入仓，只记 `repo`；同时是 Anthropic 官方插件的另带 `plugin`

清单记目标态，允许比实装超前：`custom` 条目可以先于目录存在。`make list` 查全量。

## 创建

- `custom`：在 `creator/skills/<name>.md` 写元指令，让 Claude 执行——先核实上游是否已有同类（有则记 `official`，不自建），没有再用 `/skill-creator` 生成到 `skills/<name>/`。完整流程见 [`creator/README.md`](../creator/README.md)
- `mirror`：往 `skills.json` 加条目（`name`/`repo`/`path`），`make sync` 拉取
- `official`：往 `skills.json` 加条目（`name`/`repo`），无实体

## 维护

```bash
make check   # mirror 上游差异 + 清单核对（只读）
make sync    # 拉取有更新的 mirror、补齐清单
```

- 改 `custom`：直接改 `skills/<name>/`，commit、push
- `make sync` 后 `skills/<name>/` 为空：上游目录挪了，用 `gh` 查 SKILL.md 新位置，更新 `path` 重拉
- mirror 被 skills.sh 收录：条目改 `official`，删 `skills/<name>/`
- 退役：删实体目录，并手动删清单条目（对账脚本只增不删）

`make sync` 后自行 review 再提交：`git diff skills/ && git add skills/ skills.json`。

## 使用

```bash
pnpx skills add oNo500/infra-ai -s <name>   # custom/mirror 装单个
pnpx skills add oNo500/infra-ai --all       # 仓内持有的全装
pnpx skills add <owner>/<repo> -s <name>    # official 直装上游
pnpx skills update                          # 全部更新
```

official 不经本仓分发；带 `plugin` 字段的另可 `claude plugin install <plugin>`。
不发布到 skills.sh 注册表。按组批量安装的机制见
[`docs/skills/plugin-grouping.md`](../docs/skills/plugin-grouping.md)，未引入。
