---
name: gitflow-commit
description: >
  Git 工作流技能，基于 GitHub Flow 分支策略，支持 Conventional Commits 提交规范和 PR 管理。
  当用户需要提交代码、创建功能分支、开 PR、做代码审查或遵循 GitHub Flow 分支规范时触发。
  触发词："提交代码"、"创建分支"、"开 PR"、"审查代码"、"合并功能"、"git commit"、"push 代码"。
---

# GitHub Flow Commit

按照 GitHub Flow + Conventional Commits 规范管理 git 历史。

## 分支策略

- `master` — 唯一长期分支，始终保持可部署状态，禁止直接提交
- `feature/<简短名称>` — 每个任务一个分支（如 `feature/login-form`）
- `fix/<简短名称>` — 缺陷修复（如 `fix/token-expiry`）

## 工作流

### 1. 创建功能分支

始终从最新的 `master` 创建分支：

```bash
git checkout master
git pull origin master
git checkout -b feature/<名称>
```

### 2. 提交（Conventional Commits）

格式：`<类型>[(范围)]: <描述>`

常用类型：`feat`、`fix`、`docs`、`refactor`、`test`、`chore`

```bash
git add <文件>
git commit -m "feat(auth): 添加 JWT refresh token 支持"
```

完整类型参考见 [references/conventional-commits.md](references/conventional-commits.md)。

### 3. 同步 master 更新（开发中途）

若 `master` 在开发过程中有新提交，及时 rebase 以避免冲突：

```bash
git fetch origin
git rebase origin/master
```

### 4. Push 并开 PR

```bash
git push origin feature/<名称>
# 通过 gh CLI 开 PR：
gh pr create --base master --title "feat: <描述>" --body "..." --reviewer <用户名>
```

PR 描述应包含：
- 改了什么、为什么改

### 5. 代码审查

被要求审查 PR 时：
- 检查 bug（逻辑错误、边界情况、空值处理）
- 验证是否符合代码风格规范
- 所有 CI 检查通过且无阻塞问题时才批准

## 快速参考

| 操作 | 命令 |
|------|------|
| 同步 master | `git checkout master && git pull origin master` |
| 新建功能分支 | `git checkout -b feature/<名称> master` |
| 新建修复分支 | `git checkout -b fix/<名称> master` |
| 同步 master 更新 | `git fetch origin && git rebase origin/master` |
| Push 分支 | `git push origin <分支>` |
| 开 PR | `gh pr create --base master` |
| 查看 PR | `gh pr view` |
| 合并 PR | `gh pr merge --rebase --delete-branch` |

## 规则

- 禁止直接提交到 `master`
- 每次提交只包含一个逻辑变更
- 提交信息标题行尽量简洁，控制在一行内
- 优先使用 rebase merge 保持 `master` 历史线性整洁
- merge 后自动删除远端分支（`--delete-branch`），并同步删除本地分支（`git branch -d <分支>`）
