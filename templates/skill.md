# [Skill 名称]

[一到两句话：这个 skill 做什么，解决什么问题，什么时候会被自动触发。]

**来源：官方收录 | 自建** —— [说明是从 Anthropic 官方插件目录安装的，还是本仓库自建的]。

## 核实是否已被官方收录

[新增 skill 前先查：Anthropic 官方插件目录（`anthropics/claude-plugins-official`）里，
skill 是内嵌在某个插件目录下的 `skills/` 子目录中，不是独立顶层条目，需要两层查询：]

优先经 ungh（免认证只读，headless 构建沙箱放行了 `WebFetch(domain:ungh.cc)`）：
WebFetch `https://ungh.cc/repos/anthropics/claude-plugins-official/files/main`
返回全量文件树，一次调用即可筛出 `plugins/*/skills/*` 与 `external_plugins/*` 下的同类 skill。

对话式构建且本机已登录 gh 时，等价命令：

```bash
gh api repos/anthropics/claude-plugins-official/contents/plugins --jq '.[].name'
gh api repos/anthropics/claude-plugins-official/contents/plugins/[plugin-name]/skills --jq '.[].name'
```

若命中，优先直接安装对应插件（见下），而不是照抄内容自建一份；
若未命中，按下面的自建流程创建。

## 安装（若官方已收录）

```bash
claude plugin install [plugin-name]
```

## 自建（若未被官方收录）

```
skills/[name]/
├── SKILL.md        # 入口：frontmatter（name、description） + 工作流
├── assets/         # Claude 执行 skill 时填充的模板文件
└── references/     # 说明如何填充模板的指南文档
```

`SKILL.md` frontmatter 要求：

```yaml
---
name: [与目录名一致]
description: >
  [做什么]。[什么条件下触发——具体场景]。
  触发词："[短语1]"、"[短语2]"。
---
```

`description` 必须足够具体，让 Claude 能无歧义地自动调用——需包含触发词和示例场景。

## 上下文开销

[skill 本身几乎零常驻开销——仅在被触发时才加载 SKILL.md 及其引用的 assets/references。
若该 skill 会拉起额外的 agent 或 MCP，在此注明。]
