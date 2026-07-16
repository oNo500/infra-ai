---
name: gitflow-commit
status: ready
---

# 元指令：gitflow-commit skill

GitHub Flow 分支策略与 PR 流程。素材：git 历史旧实现（7ce2add^）。
分工：提交信息规范归 commit-lite skill，本 skill 只管分支、同步、PR、审查；
旧实现里的 Conventional Commits 节与 context-manager/commit-validator
agent 引用（已不存在）一律不带入。

## frontmatter

```yaml
name: gitflow-commit
description: >-
  GitHub Flow branch strategy and PR workflow -- single master trunk,
  feature branches only on explicit request, rebase-first history.
  Use when creating branches, opening PRs, reviewing PRs, or deciding
  branch strategy before coding. For commit messages use commit-lite.
---
```

## 正文素材

分支策略：

- `master` 唯一长期分支，始终可部署
- 默认直接在当前分支提交；只有用户明确说「创建分支」「开 PR」时
  才走 `feature/<名>`、`fix/<名>` + PR 流程
- 分支始终从最新 master 创建；开发中途 master 有新提交及时
  `git fetch && git rebase origin/master`

PR 流程：

- `gh pr create --base master`，描述写清改了什么、为什么改
- 审查要点：逻辑错误、边界情况、空值处理；符合代码风格；
  CI 全绿且无阻塞才批准
- 合并优先 rebase merge 保持线性历史；`gh pr merge --rebase
  --delete-branch`，并删本地分支

纪律：每次提交只含一个逻辑变更；标题行一行内；开 PR 前建议 `/clear`
后重读 diff 做最终 review（清空上下文比长会话末尾更容易发现问题）。

## 产物要求

- 只生成 `skills/gitflow-commit/SKILL.md`；常用命令给速查（列表形式）
