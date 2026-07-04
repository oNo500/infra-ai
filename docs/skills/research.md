# research

通过 Tavily LLM 优化搜索 API 进行网络搜索。单次检索通道，无多步骤研究工作流，
适合"就是要搜一下"的轻量场景。

**来源：第三方（未被 Anthropic 官方插件目录收录）** —— [tavily-ai/skills](https://github.com/tavily-ai/skills)

## 核实是否已被官方收录

已核实（见下），未命中：

```bash
gh api repos/anthropics/claude-plugins-official/contents/plugins --jq '.[].name' | grep -i tavily
gh api repos/anthropics/claude-plugins-official/contents/external_plugins --jq '.[].name' | grep -i tavily
# 均无输出 —— 未被官方目录收录，按第三方来源使用
```

## 安装

参照 [tavily-ai/skills](https://github.com/tavily-ai/skills) 仓库的安装说明。

## 与 deep-research 的区别

`research` 是单一检索入口，没有分解子问题、多轮综合的流程；需要结构化调研报告时用
[deep-research](./deep-research.md)，只是快速查一下用这个。

## 上下文开销

单次调用，随查询结果长度变化。
