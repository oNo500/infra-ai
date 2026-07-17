---
name: ctx-init
status: ready
---

# 元指令：ctx-init skill

在目标项目初始化 Claude Code 配置——使用端 CLI（iuse）立项前的过渡方案，
skill 形态的手动拼装流程。素材：git 历史旧实现的五步骨架（7ce2add^）+
本仓现有资产现实（profiles.json、rules/ 产物、templates/）。

## frontmatter

```yaml
name: ctx-init
description: >-
  Initializes Claude Code configuration for a project from the infra-ai
  central source -- picks a profile, copies its rules, instantiates
  CLAUDE.md and architecture templates. Use when setting up .claude/
  config for a new or existing project, as an alternative to claude init.
---
```

## 正文素材（五步流程，基于本仓产物而非旧的内嵌资产）

1. 扫描项目定类型：读 package.json、pnpm-workspace.yaml、语言与框架
   依赖，判断单体/monorepo 与技术栈
2. 选 profile：读中心源 `profiles.json`（默认 `~/code/infra-ai`，可被
   INFRA_AI_ROOT 覆盖），按项目类型选最接近的 profile；没有合适的
   就提请用户裁决，不自造组合
3. 拷贝规则：把 profile 内每条 rule 从中心源 `rules/global|scoped/`
   拷到目标 `.claude/rules/<name>.md`，原样不改（源只在中心仓改）
4. 实例化模板：以 `templates/architecture.md` 为骨架结合项目事实生成
   `.claude/rules/architecture.md`（占位符全替换、不适用章节整节删）；
   `templates/claude-md.md` 生成入口 `CLAUDE.md`（<50 行，最后生成）；
   `templates/settings.json` 拷贝
5. 验证：无 `[ALL_CAPS]` 残留、CLAUDE.md <50 行、scoped rule 带 paths
   frontmatter、global 不带

monorepo 差异：每个有实质代码的子包一份 scoped rule
（paths: `packages/<name>/**`），纯配置包忽略。

## 产物要求

- 只生成 `skills/ctx-init/SKILL.md`；步骤可复制为 checklist
