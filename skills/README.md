# Skills

自建与镜像 skill 的单一数据源，同步到 GitHub，供其他项目/设备用 `pnpx skills` 管理。
不发布到 skills.sh 注册表。

自建与镜像**平铺同库**，靠仓库根的 `mirrors.json` 区分：列在里面 = 镜像，不在 = 自建。

## 自建 skill

1. `/skill-creator` 创建到 `skills/<name>/`（遵循 skills.sh 标准 + Anthropic best practices）
2. commit（走 `gitflow-commit`）→ push

## 镜像 skill

上游不在 skills.sh 注册表内、但有可用 SKILL.md 的开源仓库。用 giget 拉单目录，不克隆整库。

### 新增

往根目录 `mirrors.json` 加一条：

```json
{ "name": "<上游 SKILL.md 的 name>", "repo": "<owner>/<repo>", "path": "<SKILL.md 所在目录>" }
```

然后 `make sync` 拉取。

### 日常同步

```bash
make check   # 只报上游 commit 差异 (只读)
make sync    # 有更新才 giget 拉到 skills/<name>/ 并回写 mirrors.json (不 commit)
```

`make sync` 后自行 review 再提交：

```bash
git diff skills/
git add skills/ mirrors.json
git commit -m "chore(skills): sync mirrors"
git push
```

### 上游重构路径时

giget 对不存在的路径不报错，会静默拉出空目录。若 `make sync` 后
`skills/<name>/` 为空，多半是上游把 skill 移走了 —— 到上游仓库找到 SKILL.md 的新位置，
更新 `mirrors.json` 的 `path`，重跑 `make sync`。

## 分发

任何项目/设备：

```bash
pnpx skills add oNo500/infra-ai -s <name>   # 挑单个
pnpx skills add oNo500/infra-ai --all       # 全装
```

上游更新后各处 `pnpx skills update` 拉最新。
