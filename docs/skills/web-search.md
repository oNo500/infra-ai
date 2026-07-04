# web-search

网络搜索，返回排名结果、摘要、URL、缩略图。作为 CLAUDE.md 检索策略里
`context7 → Vercel Grep → Exa → Brave Search` 的最后一层兜底手段触发。

**来源：第三方（未被 Anthropic 官方插件目录收录）** —— [brave/brave-search-skills](https://github.com/brave/brave-search-skills)

## 核实是否已被官方收录

已核实（见下），未命中：

```bash
gh api repos/anthropics/claude-plugins-official/contents/plugins --jq '.[].name' | grep -i brave
gh api repos/anthropics/claude-plugins-official/contents/external_plugins --jq '.[].name' | grep -i brave
# 均无输出 —— 未被官方目录收录，按第三方来源使用
```

## 安装

参照 [brave/brave-search-skills](https://github.com/brave/brave-search-skills) 仓库的安装说明。

## 上下文开销

按需触发，仅在检索策略前三层（context7、Vercel Grep、Exa）都未能满足时才使用。
