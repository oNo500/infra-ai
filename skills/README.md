# Skills

常用 skill 的维护与分发。`skills.json`（仓库根）是全量总账，每个 skill 一条，
`source` 字段区分三类来源：

- `custom` — 自建，在 `skills/` 里，只需 `name`
- `mirror` — giget 拉自上游开源仓库，在 `skills/` 里，带 `repo`/`path`/`commit`/`updated`
- `official` — 符合 skills.sh 标准，**不在** `skills/` 里，只需 `name`/`repo`，靠 `pnpx skills add <repo> -s <name>`；若同时是 Anthropic 官方插件，额外带 `plugin` 字段，另可 `claude plugin install <plugin>`

`make list` 随时查全量 skill 及来源。仓内持有的（custom + mirror）同步到 GitHub，
供其他项目/设备用 `pnpx skills` 管理。不发布到 skills.sh 注册表。

## 自建 skill (custom)

1. `/skill-creator` 创建到 `skills/<name>/`（遵循 skills.sh 标准 + Anthropic best practices）
2. 往 `skills.json` 加 `{ "name": "<name>", "source": "custom" }`
3. commit（走 `gitflow-commit`）→ push

## 镜像 skill (mirror)

上游不在 skills.sh 注册表内、但有可用 SKILL.md 的开源仓库。用 giget 拉单目录，不克隆整库。

### 新增

往 `skills.json` 加一条：

```json
{ "name": "<上游 SKILL.md 的 name>", "source": "mirror", "repo": "<owner>/<repo>", "path": "<SKILL.md 所在目录>" }
```

然后 `make sync` 拉取。

### 日常同步

```bash
make check   # 只报上游 commit 差异 (只读)
make sync    # 有更新才 giget 拉到 skills/<name>/ 并回写 commit/updated (不 commit)
```

`make sync` 后自行 review 再提交：

```bash
git diff skills/
git add skills/ skills.json
git commit -m "chore(skills): sync mirrors"
git push
```

### 上游变更的两种处理

更新上游时，很可能因为上游目录变动或 skill 转正：

- **上游目录变更**：giget 对不存在的路径不报错，会静默拉出空目录。若 `make sync` 后
  `skills/<name>/` 为空，用 `gh` 查上游 SKILL.md 的新位置，更新 `skills.json` 的 `path`
  重跑 `make sync`。
- **上游变为标准 skill**：若上游被 skills.sh 收录或发布为官方插件，不再镜像 —— 把该条目
  从 `mirror` 改为 `official`（或直接移除），删 `skills/<name>/`，改用标准安装。

## 标准 skill (official)

上游符合 skills.sh 标准、可 `pnpx skills add` 的 skill。不放进 `skills/`。

往 `skills.json` 加 `{ "name": "<name>", "source": "official", "repo": "<owner>/<repo>" }`，
各处自行 `pnpx skills add <repo> -s <name>`。

若同时是 Anthropic 官方插件（如 defuddle），额外带 `plugin` 字段，另可 `claude plugin install <plugin>`：

```json
{ "name": "defuddle", "source": "official", "repo": "anthropics/claude-plugins-official", "plugin": "defuddle" }
```

## 分发

任何项目/设备：

```bash
pnpx skills add oNo500/infra-ai -s <name>   # 挑单个 (custom/mirror)
pnpx skills add oNo500/infra-ai --all       # 全装仓内持有的
```

`official` 类不经本仓库分发——各处自行 `pnpx skills add <repo> -s <name>`；
带 `plugin` 字段的 Anthropic 官方插件另可 `claude plugin install <plugin>`。
上游更新后各处 `pnpx skills update` 拉最新。

按组批量安装（把 skill 分成命名组分发）的机制见
[`docs/skills/plugin-grouping.md`](../docs/skills/plugin-grouping.md)，当前未引入。
