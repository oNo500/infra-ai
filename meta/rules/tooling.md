---
name: tooling
status: ready
scope: global
tags: [core, workflow]
---

# 元指令：tooling rule

工具选用姿态，global 无条件加载。收编自用户全局 CLAUDE.md 的
Tooling & Workflow 节与 notes 仓 rc-claudemd、AI-ClaudeCode-终端工具——
此后中心源接管，全局 CLAUDE.md 瘦身为入口。

## 约束（素材，构建时组织成产物）

- 代码导航：LSP（goToDefinition/findReferences）优先于文本搜索；
  `rg`/`fd` 只用于字符串、注释、配置
- 重构：变更函数签名前 MUST 先 findReferences
- 信息检索链：`context7`（第三方 API 文档）→ Vercel Grep（真实用法）→
  Exa（趋势/对比）→ Brave Search（兜底）；检索注意时效性与认可度，
  验证可信度
- CLI 偏好：`gh` 替代 `curl`；`sg`（ast-grep）做 AST 级操作；shell 假定 zsh
- CLI-first：能用 CLI 解决的场景一律优先于 MCP——零协议成本、
  零常驻上下文占用；挑 CLI 三标准：`--help` 完善、支持 `--json`、幂等

## 产物要求

- global 落点：不超过 12 行正文，姿态化
- 素材源：`~/.claude/CLAUDE.md` Tooling & Workflow 节、notes 仓
  `20-areas/20-05-rc/rc-claudemd.md`、
  `30-resources/30-05-ai/claude-code/AI-ClaudeCode-终端工具.md`
