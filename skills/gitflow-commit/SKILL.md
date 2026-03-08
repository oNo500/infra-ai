---
name: gitflow-commit
description: >
  Git 工作流技能，基于 GitFlow lite 分支策略，支持 Conventional Commits 提交规范和 PR 管理。
  当用户需要提交代码、创建功能分支、开 PR、做代码审查或遵循 GitFlow 分支规范时触发。
  触发词："提交代码"、"创建分支"、"开 PR"、"审查代码"、"合并功能"、"git commit"、"push 代码"。
---

# GitFlow Commit

按照 GitFlow lite 分支策略 + Conventional Commits 规范管理 git 历史。

## 分支策略

- `master` — 生产环境，禁止直接提交
- `dev` — 集成分支，所有功能分支的基础
- `feature/<简短名称>` — 每个任务一个分支（如 `feature/login-form`）
- `fix/<简短名称>` — 缺陷修复（如 `fix/token-expiry`）
- `release/<版本号>` — 发布准备（可选）

## 工作流

### 1. 创建功能分支

始终从 `dev` 创建分支：

```bash
git checkout dev
git pull origin dev
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

### 3. Push 并开 PR

```bash
git push origin feature/<名称>
# 通过 gh CLI 开 PR：
gh pr create --base dev --title "feat: <描述>" --body "..."
```

PR 描述应包含：
- 改了什么、为什么改
- 标注相关审查者（如 UI 改动 `@frontend-team`）

### 4. 更新文档（如需要）

若改动影响用户可见行为或 API，在同一 PR 中更新 `docs/` 文件夹。

### 5. 代码审查

被要求审查 PR 时：
- 检查 bug（逻辑错误、边界情况、空值处理）
- 验证是否符合代码风格规范
- 所有 CI 检查通过且无阻塞问题时才批准

## 快速参考

| 操作 | 命令 |
|------|------|
| 新建功能分支 | `git checkout -b feature/<名称> dev` |
| 新建修复分支 | `git checkout -b fix/<名称> dev` |
| Push 分支 | `git push origin <分支>` |
| 开 PR | `gh pr create --base dev` |
| 查看 PR | `gh pr view` |
| 合并 PR | `gh pr merge --squash` |

## 规则

- 禁止直接提交到 `master`
- 禁止直接提交到 `dev`（使用 PR）
- 每次提交只包含一个逻辑变更
- 提交信息第一行不超过 72 个字符
- 优先使用 squash merge 保持 `dev`/`master` 历史整洁
