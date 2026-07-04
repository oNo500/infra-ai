# Skills 维护系统设计

## 目标

在 `infra-ai/skills/` 维护常用 skill —— 自建、镜像开源、官方收录三类 —— 用一份
`skills.json` 总账记录全部 skill 及其来源，作为单一数据源。仓内持有的 skill 同步到
GitHub，供其他项目/设备用 `pnpx skills` 管理。不发布到 skills.sh 注册表。

## 目录结构

```
infra-ai/
├── Makefile                     # 唯一入口, 薄封装, 只调用 scripts/*.sh
├── scripts/
│   ├── sync-skills.sh           # 镜像同步 check/update (从根目录移入)
│   └── init-project.sh          # 对外脚手架 (不进 Makefile)
├── skills/                      # 仓内持有的 skill, 平铺, 全部入 git
│   ├── README.md                # 维护 + 分发流程文档
│   └── <name>/SKILL.md          # 自建与镜像同库平铺
└── skills.json                  # 全量 skill 总账 — 单一数据源
```

## 数据模型：skills.json

全量清单，每个 skill 一条，`source` 字段区分三类来源：

```json
[
  { "name": "gitflow-commit", "source": "custom" },
  {
    "name": "drawio", "source": "mirror",
    "repo": "jgraph/drawio-mcp",
    "path": "plugins/claude-code/skills/drawio",
    "commit": "516965c...", "updated": "2026-07-04"
  },
  { "name": "skill-creator", "source": "official", "plugin": "skill-creator" }
]
```

- `custom` — 自建，在 `skills/` 里，只需 `name`
- `mirror` — giget 拉自上游，在 `skills/` 里，带 `repo`/`path`/`commit`/`updated`；sync 只处理这类
- `official` — 官方插件，**不在** `skills/` 里，带 `plugin` 名，靠 `claude plugin install`

`skills.json` 是唯一数据源：区分逻辑、`make list` 总览、镜像 sync 全从它派生。

## 三条流程

### 自建 skill (custom)

1. `/skill-creator` 创建到 `skills/<name>/`（遵循 skills.sh 标准 + Anthropic best practices）
2. 往 `skills.json` 加 `{ "name": "<name>", "source": "custom" }`
3. commit（走 `gitflow-commit`）→ push

### 镜像 skill (mirror)

上游不在 skills.sh 注册表内、但有可用 SKILL.md 的开源仓库。用 giget 拉单目录，不克隆整库。

1. **新增**：往 `skills.json` 加 `{ "name", "source": "mirror", "repo", "path" }`
   （`name` = 上游 SKILL.md 的 `name`；`path` = SKILL.md 所在目录），`make sync` 拉取
2. **同步**：`make check` 只报上游 commit 差异（只读）；`make sync` 才 giget 拉到
   `skills/<name>/` 并回写 `commit`/`updated`。只拉取，不 commit
3. **上游目录变更**：giget 对不存在的路径不报错、静默拉空目录。若拉出空目录，用 gh 查上游
   SKILL.md 新位置，更新 `path` 重拉
4. **上游变为标准 skill**：若上游被 skills.sh 收录或发布为官方插件，不再镜像 —— 把该条目
   从 `mirror` 改为 `official`（或直接移除），删 `skills/<name>/`，改用标准安装

### 官方收录 skill (official)

新增 skill 前先核实是否已被官方收录（见 `templates/skill.md` 的核实流程）。命中则
`claude plugin install <plugin>`，往 `skills.json` 加
`{ "name", "source": "official", "plugin" }`。不放进 `skills/`。

### 分发

任何项目/设备：

```bash
pnpx skills add oNo500/infra-ai -s <name>   # 挑单个 (custom/mirror)
pnpx skills add oNo500/infra-ai --all       # 全装仓内持有的
```

`official` 类不经分发，各处 `claude plugin install`。

## 脚本管理：Makefile 薄封装

Makefile 只封装"对本仓操作"的命令；target 只调用对应脚本，不写业务逻辑。

```makefile
.PHONY: help check sync list

help:            ## 列出所有命令
check:           ## 检查镜像上游有无更新 (只读)
sync:            ## 同步有更新的镜像到 skills/ (不 commit)
list:            ## 列出全量 skill 及来源 (读 skills.json)
```

`make help` 靠 target 后的 `## 注释` 自动生成命令清单（SSoT）。`make list` 读 `skills.json`
输出每个 skill 及其来源，补全总览闭环。

`init-project.sh` 是对外脚手架工具（带 `<target-dir>` 参数，用户通常在别的项目目录里跑），
不进 Makefile，保持独立脚本。

## sync-skills.sh 行为

- 只处理 `skills.json` 中 `source == "mirror"` 的条目（jq 过滤），跳过 custom/official
- `check`：比对本地 `commit` 与上游最新 commit，只读报差异
- `sync`：上游变了就 giget 拉到 `skills/<name>/` 并回写 `commit`/`updated`，不 commit
- 路径引用（脚本在 `scripts/` 下）：`skills.json` 与 `skills/` 均在仓库根，用 `$(dirname "$0")/../`

## 清理

- `ruler/sync-skill.md`：内容（上游目录变更、上游变标准 skill 两条镜像规则）并入
  `skills/README.md` 后删除该文件
- `skills-lock.json`：`pnpx skills` 消费端产物，被全局 gitignore、从未入库；本地过时残留已删

## 日常维护动作

`make check` → 有 `[outdated]` 就 `make sync` → `git diff skills/` review → commit + push
→ 各处 `pnpx skills update`。`make list` 随时查全量 skill 及来源。
