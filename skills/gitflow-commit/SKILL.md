---
name: gitflow-commit
description: >-
  GitHub Flow branch strategy and PR workflow -- single master trunk,
  feature branches only on explicit request, rebase-first history.
  Use when creating branches, opening PRs, reviewing PRs, or deciding
  branch strategy before coding. For commit messages use commit-lite.
---

# GitFlow Commit

GitHub Flow 分支策略与 PR 流程。提交信息规范不在此 skill 内，写 commit
message 时使用 commit-lite。

## 分支策略

- `master` 是唯一长期分支，始终保持可部署
- 默认直接在当前分支提交；只有用户明确说「创建分支」「开 PR」时，
  才走 `feature/<名>`、`fix/<名>` + PR 流程
- 分支始终从最新 master 创建
- 开发中途 master 有新提交，及时同步：`git fetch && git rebase origin/master`

## PR 流程

1. 开 PR 前建议 `/clear` 后重读 diff 做最终 review——
   清空上下文比长会话末尾更容易发现问题
2. `gh pr create --base master`，描述写清改了什么、为什么改
3. 审查通过且 CI 全绿后合并，优先 rebase merge 保持线性历史

## 审查要点

- 逻辑错误、边界情况、空值处理
- 符合项目代码风格
- CI 全绿且无阻塞意见才批准

## 提交纪律

- 每次提交只含一个逻辑变更
- 标题行一行内

## 命令速查

- 创建分支：`git checkout -b feature/<名> origin/master`
- 同步 master：`git fetch && git rebase origin/master`
- 开 PR：`gh pr create --base master`
- 合并 PR：`gh pr merge --rebase --delete-branch`
- 删本地分支：`git branch -d <名>`（merge 后）
