# Tooling

- 代码导航用 LSP（goToDefinition / findReferences）；`rg`/`fd` 只用于字符串、注释与配置
- 变更函数签名前 MUST 先 findReferences 确认全部引用点
- 第三方库信息检索链：`context7`（API 文档）→ Vercel Grep（真实用法）→ Exa（趋势/对比）→ Brave Search（兜底）；采信前核对时效性与认可度
- CLI-first：能用 CLI 解决就不上 MCP——零协议成本、零常驻上下文占用；选 CLI 看三点：`--help` 完善、支持 `--json`、幂等
- `gh` 替代 `curl`；AST 级查改用 `sg`（ast-grep）；shell 假定 zsh
