# find-skills

发现和安装 agent skills 的元工具。用于降低以后手动查找、评估新 skill 的成本。

**来源：第三方（未被 Anthropic 官方插件目录收录）** —— [vercel-labs/skills](https://github.com/vercel-labs/skills)

## 核实是否已被官方收录

已核实（见下），未命中：

```bash
gh api repos/anthropics/claude-plugins-official/contents/plugins --jq '.[].name' | grep -i find-skill
gh api repos/anthropics/claude-plugins-official/contents/external_plugins --jq '.[].name' | grep -i find-skill
# 均无输出 —— 未被官方目录收录，按第三方来源使用
```

## 安装

参照 [vercel-labs/skills](https://github.com/vercel-labs/skills) 仓库的安装说明。

## 上下文开销

一次性/低频使用（新增 skill 时才触发），非常驻开销。
