---
name: commit-lite
target: skill
status: ready
---

# 元指令：commit-lite skill

触发后，在仓库根 `skills/commit-lite/` 下生成 `SKILL.md`。

## 目标

引导 Claude 根据 `git diff --staged` 输出符合 Conventional Commits 的 commit message，精简为常用 type，移除低频项。

## 保留的 type

- `feat` — 新功能（SemVer MINOR）
- `fix` — bug 修复（SemVer PATCH）
- `refactor` — 重构，不改行为（含性能优化）
- `chore` — 构建、依赖、配置、脚手架（含 build/style）
- `test` — 测试新增或修改
- `docs` — 文档
- `ci` — CI/CD 配置

移除：`style`（归入 `refactor`）、`build`（归入 `chore`）、`perf`（归入 `refactor`）、`revert`（用 git revert 原生命令）。

## SKILL.md 规范

### frontmatter

```yaml
---
name: commit-lite
description: >-
  Generates Conventional Commits messages from staged changes.
  Use when the user asks for a commit message, says "commit",
  "help me commit", or asks to summarize staged changes.
---
```

### 正文结构

格式规则（来自规范）：

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

约束：
- description 用祈使句，英文，首字母小写，不加句号
- description **最多 20 字符**（不含 type/scope 前缀）
- scope 可选，用括号，如 `feat(auth):`
- **默认不写 body**；仅 breaking change 时写 footer
- breaking change 用 `!` 后缀或 footer `BREAKING CHANGE: <desc>`，两者可并用

规范参考：https://www.conventionalcommits.org/en/v1.0.0/

工作流：
1. 读取 `git diff --staged` 输出
2. 从保留的 7 个 type 中选一个
3. scope 可选：仅当变更集中在单一模块/目录时加
4. description 控制在 20 字符内，用最少词命中核心改动
5. 若有 breaking change，加 `!` 并写 footer

示例：

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

## 输出路径

仓库根 `skills/commit-lite/SKILL.md`，`make meta` 的 `s` 视图 `f` 上账后各处安装：

```bash
pnpx skills add oNo500/infra-ai -s commit-lite
```
