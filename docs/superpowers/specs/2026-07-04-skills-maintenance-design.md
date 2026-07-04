# Skills 维护系统设计

## 目标

在 `infra-ai/skills/` 维护两类 skill —— 自建的与镜像开源的 —— 作为单一数据源同步到
GitHub，供其他项目/设备用 `pnpx skills` 管理。不发布到 skills.sh 注册表。

## 目录结构

```
infra-ai/
├── Makefile                     # 唯一入口, 薄封装, 只调用 scripts/*.sh
├── scripts/
│   ├── sync-skills.sh           # 镜像同步 check/update (从根目录移入)
│   └── init-project.sh          # 对外脚手架 (不进 Makefile)
├── skills/                      # 单一数据源, 平铺, 全部入 git
│   ├── README.md                # 维护 + 分发流程文档
│   └── <name>/SKILL.md          # 自建与镜像同库平铺
└── mirrors.json                 # 镜像元数据 — 区分两类的依据
```

自建与镜像**平铺同库**，靠 `mirrors.json` 区分：列在里面 = 镜像，不在 = 自建。
平铺兼容 `pnpx skills` 对 `skills/<name>/` 的识别约定。

## 三条流程

### 自建 skill

1. `/skill-creator` 创建到 `skills/<name>/`（遵循 skills.sh 标准 + Anthropic best practices）
2. git commit（走 `gitflow-commit`）→ push

### 镜像 skill

上游不在 skills.sh 注册表内、但有可用 SKILL.md 的开源仓库。用 giget 拉单目录，不克隆整库。

1. **新增**：往 `mirrors.json` 加一条（`name` / `repo` / `path`）。
   - `name` = 上游 SKILL.md 的 `name:` 字段
   - `path` = 上游仓库中 SKILL.md 所在目录（不含文件名）
2. **同步**：`make check` 只报上游 commit 差异（只读）；`make sync` 才 giget 拉取到
   `skills/<name>/` 并回写 `mirrors.json`（新 commit + 日期）。
3. `sync` **只拉取，不 commit** —— commit/push 由人工或 `gitflow-commit` 控制，保留 review
   上游变更的机会。

### 分发

任何项目/设备：

```bash
pnpx skills add oNo500/infra-ai -s <name>   # 挑单个
pnpx skills add oNo500/infra-ai --all       # 全装
```

默认 symlink 到 `~/.claude/skills/` 或项目 `.claude/skills/`。上游更新后各处
`pnpx skills update` 拉最新。

## 脚本管理：Makefile 薄封装

Makefile 只封装"对本仓操作"的命令；target 只调用对应脚本，不写业务逻辑。

```makefile
.PHONY: help check sync

help:            ## 列出所有命令
	@grep ...

check:           ## 检查镜像上游有无更新 (只读)
	@scripts/sync-skills.sh check

sync:            ## 同步有更新的镜像到 skills/ (不 commit)
	@scripts/sync-skills.sh update
```

`make help` 靠 target 后的 `## 注释` 自动生成命令清单（SSoT，加脚本只写一行注释）。

`init-project.sh` 是对外脚手架工具（带 `<target-dir>` 参数，用户通常在别的项目目录里跑），
不进 Makefile，保持独立脚本，外部按需 `path/to/infra-ai/scripts/init-project.sh <dir>` 调。

## sync-skills.sh 移位的连带改动

脚本从根目录移入 `scripts/` 后，`$(dirname "$0")` 变为 `scripts/`，路径引用要上移一级：

- `MIRRORS_FILE` → `$(dirname "$0")/../mirrors.json`
- `SKILLS_DIR` → `$(dirname "$0")/../skills`（原为 `$HOME/.claude/skills`）

`SKILLS_DIR` 的改动是"镜像入 git"决策的落地点 —— 改错目标整条链路就断。
check/update 的核心逻辑不变。

## 清理

- `skills-lock.json`：`git rm` 移除。它是 `pnpx skills` 的消费端产物（记录某机器/项目装了哪些
  skill），源仓库不持有。不进 `.gitignore`、不手动维护 —— infra-ai 自身不作为消费端装 skill。
- `mirrors.json`：保留现有 `drawio` 条目不动。

## 日常维护动作

`make check` → 有 `[outdated]` 就 `make sync` → `git diff skills/` review → commit + push
→ 各处 `pnpx skills update`。全 `[up-to-date]` 则到 check 为止。
