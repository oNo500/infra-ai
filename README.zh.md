# Infra AI

个人 Claude Code 基础设施 —— skills、agents、rules 和 MCP 配置。

> 借鉴自：
> 1. https://github.com/affaan-m/everything-claude-code/tree/main
> 2. https://github.com/shanraisshan/claude-code-best-practice
> 通读下来没有生产级项目的架构学，或者代码文件组织规范
> 制作实例，我看到了很多通用学，可以将自己的 最高规则和文件组织规范，让ai澄清这些属于哲学类的还是架构学类的，如何写成一个有效的规范？

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

---

## 快速指南：MCP vs Skills vs Agents

| 需求 | 方案 |
|------|------|
| 连接外部服务（数据库、Notion、GitHub API、浏览器） | MCP Server |
| 可复用的提示工作流（git 流程、写文档、代码审查） | Skill |
| 独立运行、有自己工具集的自治子任务 | Agent |

**MCP** — 为 Claude 添加新的*工具*。当 Claude 需要调用外部 API 或控制外部软件时使用。

**Skill** — 通过现有 Skill 工具为 Claude 添加可复用的*工作流*。任务是提示驱动且不需要新工具集成时使用。

**Agent** — 以子进程方式运行，有独立上下文。任务自包含、可并行或需要与主上下文隔离时使用。

> 添加自定义工具 → 连接 MCP server（`claude mcp add`）
> 添加可复用工作流 → 编写 skill（通过 Skill 工具运行，无需新增工具条目）
> 添加自治任务执行器 → 在 `.claude/agents/` 中编写 agent

---

## Claude Code 最佳实践

> 来源：[Claude Code 官方文档 — Best Practices](https://code.claude.com/docs/en/best-practices)

最核心的约束：**上下文窗口很快就会填满，填满后性能下降。** 以下所有实践都围绕这一点。

### 给 Claude 提供验证方式

提供测试、截图或预期输出，让 Claude 能自我检验——这是最高杠杆的事。

- 写代码：先写失败的测试，让 Claude 让它们通过
- 写 UI：粘贴截图，让 Claude 对比输出并修正差异
- 修构建：粘贴报错，让 Claude 找到根因并验证构建通过

### 先探索，再规划，再写代码

用 Plan Mode（`Shift+Tab` 切换）把调研和执行分开：

1. **探索** — Claude 只读文件，不做变更
2. **规划** — 让 Claude 给出详细实现计划，用 `Ctrl+G` 在编辑器中直接修改
3. **实现** — 切回 Normal Mode，让 Claude 对照计划写代码
4. **提交** — 让 Claude 提交并开 PR

简单明确的改动（改错别字、重命名、单行修改）直接跳过规划阶段。

### 提供精确的上下文

- 用 `@文件名` 引用文件，而不是描述文件在哪里
- UI 任务直接粘贴截图到提示框
- 指向已有模式：*"参考 HotDogWidget.php 的写法"*
- 描述症状时带上位置：*"session 超时后登录失败，检查 src/auth/"*

### 写好 CLAUDE.md

保持简短。每行问自己：*"删掉这行会让 Claude 出错吗？"* 不会就删。CLAUDE.md 太长会导致 Claude 忽略里面的指令。

| 应该写 | 不应该写 |
|--------|---------|
| Claude 猜不到的 Bash 命令 | Claude 读代码就能推断的内容 |
| 与默认值不同的代码风格规则 | Claude 已知的标准语言约定 |
| 测试规范和首选测试框架 | 详细的 API 文档（链接过去即可） |
| 仓库规范（分支命名、PR 约定） | 逐文件的代码库描述 |
| 项目特有的架构决策 | "写干净的代码"这类不言而喻的话 |

### 主动管理上下文

- 任务边界处用 `/clear` — CLAUDE.md + rules 会自动重载
- 调研密集的工作用 subagent，保护主上下文
- 上下文过载的信号：Claude 重新问已回答过的问题、引用已撤销的改动
- 用[自定义状态栏](https://code.claude.com/docs/en/statusline)持续监控上下文用量

### 尽早、频繁地纠偏

不要让 Claude 在错误方向走太远。2-3 步后如果方向不对，立即停下来重新引导。早纠偏比事后解套便宜得多。

### 用 Subagent 做调查性工作

把探索性任务委托给 subagent，避免在主上下文中堆积：
- 大规模代码库扫描
- 网络搜索和文档阅读
- 相互独立的并行任务

### 善用 CLI 工具

安装 `gh`、`aws`、`gcloud` 等 CLI 工具——它们是与外部服务交互最省 token 的方式。Claude 知道如何使用它们，也能通过 `--help` 学习新工具。
