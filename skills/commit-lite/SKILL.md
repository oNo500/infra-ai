---
name: commit-lite
description: >-
  Generates Conventional Commits messages from staged changes.
  Use when the user asks for a commit message, says "commit",
  "help me commit", or asks to summarize staged changes.
---

# commit-lite

根据 `git diff --staged` 生成符合 Conventional Commits 的 commit message，
type 精简为 7 个常用项。

## 格式

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

规范参考：https://www.conventionalcommits.org/en/v1.0.0/

## 允许的 type

- `feat` — 新功能（SemVer MINOR）
- `fix` — bug 修复（SemVer PATCH）
- `refactor` — 重构，不改行为（含性能优化）
- `chore` — 构建、依赖、配置、脚手架
- `test` — 测试新增或修改
- `docs` — 文档
- `ci` — CI/CD 配置

不使用以下 type，改用对应替代：

- `style` → `refactor`
- `build` → `chore`
- `perf` → `refactor`
- `revert` → 直接运行 `git revert`，不手写 message

## 约束

- description 用祈使句，英文，首字母小写，不加句号
- description 最多 20 字符（不含 type/scope 前缀）
- scope 可选，用括号（如 `feat(auth):`），仅当变更集中在单一模块/目录时加
- 默认不写 body；仅 breaking change 时写 footer
- breaking change 用 `!` 后缀或 footer `BREAKING CHANGE: <desc>`，两者可并用

## 工作流

1. 读取 `git diff --staged` 输出
2. 从允许的 7 个 type 中选一个
3. 仅当变更集中在单一模块/目录时加 scope
4. description 控制在 20 字符内，用最少词命中核心改动
5. 若有 breaking change，加 `!` 并写 `BREAKING CHANGE:` footer

## 示例

```
feat(auth): add refresh token
```

```
chore: upgrade eslint to v9
```

```
fix(api): handle null response
```

```
feat(api)!: drop v1 endpoints

BREAKING CHANGE: /v1/* routes removed.
```
