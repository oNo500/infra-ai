# deep-research

依赖 firecrawl / exa MCP 的完整研究方法论：拆解 3-5 个子问题 → 对每个子问题多轮
检索 → 综合成带引用来源的报告。适合需要结构化调研产出的场景。

**来源：本地项目提供** —— everything-claude-code（本机路径
`~/code/everything-claude-code/skills/deep-research/`），非本仓库自建，也未见于
Anthropic 官方插件目录。

## 核实是否已被官方收录

```bash
gh api repos/anthropics/claude-plugins-official/contents/plugins --jq '.[].name' | grep -i research
gh api repos/anthropics/claude-plugins-official/contents/external_plugins --jq '.[].name' | grep -i research
# 均无输出 —— 未被官方目录收录
```

## 依赖

至少需要以下 MCP 之一（两者兼备覆盖最全）：
- **firecrawl** — `firecrawl_search`、`firecrawl_scrape`、`firecrawl_crawl`
- **exa** — `web_search_exa`、`web_search_advanced_exa`、`crawling_exa`

## 与 research 的区别

`deep-research` 是流程 skill，有明确的分步工作流（理解目标 → 拆解子问题 → 多源
检索 → 综合报告）；[research](./research.md) 是单一检索入口，没有这套流程。
需要一份带引用的结构化报告时用这个，只是快速查一下用 research。

## 上下文开销

按调研深度变化，多轮检索 + 综合步骤，开销高于单次搜索类 skill。
