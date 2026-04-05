# Infra AI

个人 Claude Code 基础设施 —— skills、agents、rules 和 MCP 配置。

## 安装 Skills

```bash
# 安装全部 skills
pnpx skills add <this-repo>

# 仅列出可用 skills，不安装
pnpx skills add <this-repo> --list
```

## Skills 列表

| Skill | 描述 |
|-------|------|
| `ctx-init` | 为新项目生成 `.claude/` 上下文配置文件 |
| `gitflow-commit` | GitHub Flow + Conventional Commits 工作流 |
| `clarify` | 将复杂内容可视化为图表、树形或表格 |
| `markdown` | Markdown 语法速查，用于写文档 |
| `explain-code` | 用类比、图表和陷阱解释代码 |

## 项目结构

```
.claude/
├── agents/               # 自定义 agents（skill-reviewer、commit-validator、context-manager）
├── rules/                # 自动加载的项目规范
│   ├── constitution.md   # 核心原则
│   ├── architecture.md   # 架构约定
│   ├── context-management.md  # 上下文管理规范
│   └── skills.md         # Skills 架构规范
├── CLAUDE.md
└── settings.json
skills/                   # 可安装的 skill 定义
.mcp.json                 # MCP server 配置（使用前替换占位 key）
```

## MCP Servers

`.mcp.json` 包含四个核心 server 的模板：`context7`、`tavily`、`exa`、`browser-use`。

使用前替换占位的 API Key，详见 `skills/ctx-init/references/mcp-guide.md`。
