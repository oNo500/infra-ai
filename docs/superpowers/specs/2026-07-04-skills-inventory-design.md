# Skills Inventory — Design

将一份完整的目标态 skill 清单（约 54 个）组织进 infra-ai 的 `skills.json` 总账，
并厘清 `official` 分类的定义。

## Problem

现有 `skills.json` 只有 1 条（`drawio`，mirror）。用户提供了一份分类过的
「已安装/想装齐」skill 清单（约 54 个），其中绝大多数是第三方仓库的标准 skill
（agent-browser、tavily、brave、better-auth、drizzle 等），通过
`pnpx skills add <repo>` 安装。这类 skill 既不该进本仓库 `skills/` 目录，
也不是 Anthropic 官方插件——现有 `skills.json` 的三分类
（custom / mirror / official）中，`official` 被定义为「Anthropic 官方插件，
靠 `claude plugin install`」，装不下它们。

这份清单是**目标态/路线图**（当前机器大多未实装：`~/.claude/skills/` 为空、
lock 文件只有 `better-auth`、仓库 `skills/` 只有 `drawio`），全量记入总账，
允许总账领先于实装。

## Decisions

1. **`official` 重定义为「符合 skills.sh 标准的 skill」**——任何遵循 skills.sh
   规范、能被 `pnpx skills add <repo> -s <name>` 安装的可信上游 skill。不再绑死
   「Anthropic 官方插件 + claude plugin install」。

2. **`official` 条目最小化**——只存 `name` / `source` / `repo`。不锁 commit
   （skills.sh 标准 skill 自带版本管理，`pnpx skills update` 拉最新）。

3. **Anthropic 官方插件用 `plugin` 字段标记**——`official` 条目若同时是 Anthropic
   官方插件，额外带 `"plugin": "<name>"`，既标身份又给出
   `claude plugin install <plugin>` 的具体插件名。

4. **custom 目标态写入总账，不建空目录**——清单里标「本地 infra-ai」的自建 skill
   全部记入 `skills.json`，但不预建空的 `skills/<name>/`；目录等真正
   `/skill-creator` 时才建。

5. **drawio 保持 mirror**——它确实 giget 拉自 `jgraph/drawio-mcp`（实体 +
   repo/path/commit 都在），不改为 custom。

## Data Model

`skills.json` 是 JSON 数组，每条一个 skill，`source` 区分三类：

- **custom** — 自建，在 `skills/` 里（目标态可暂缺目录）。字段：`name`、`source`。
- **mirror** — 上游不符合 skills.sh 标准，giget 拉进 `skills/`。字段：`name`、
  `source`、`repo`、`path`、`commit`、`updated`。
- **official** — 符合 skills.sh 标准，`pnpx skills add <repo>` 装，**不在**
  `skills/` 里。字段：`name`、`source`、`repo`；Anthropic 官方插件额外带 `plugin`。

示例：

```json
[
  { "name": "explaining-code", "source": "custom" },
  { "name": "drawio", "source": "mirror", "repo": "jgraph/drawio-mcp",
    "path": "plugins/claude-code/skills/drawio",
    "commit": "516965c7c49e9ec408529d0b1a653f67814cb920", "updated": "2026-07-04" },
  { "name": "agent-browser", "source": "official", "repo": "vercel-labs/agent-browser" },
  { "name": "defuddle", "source": "official", "repo": "anthropics/claude-plugins-official",
    "plugin": "defuddle" }
]
```

## Inventory Mapping

### custom（13）

`explaining-code`、`clarify`、`gitflow-commit`、`chezmoi-sync`、`obsidian-cli`、
`obsidian-markdown`、`obsidian-bases`、`note`、`ctx-init`、`anki-connect`、
`json-canvas`、`edit-markdown`、`tailwindcss-icons`

### mirror（1）

`drawio` — `jgraph/drawio-mcp`，保持现状。

### official（约 40），按 repo 分组

- `vercel-labs/agent-browser` — agent-browser、dogfood、skill-creator
- `tavily-ai/skills` — crawl、extract、search、research、tavily-best-practices
- `anthropics/claude-plugins-official` — defuddle（带 `plugin: defuddle`）
- `firecrawl/cli` — firecrawl
- `brave/brave-search-skills` — web-search、images-search、news-search、
  videos-search、suggest、spellcheck、llm-context、answers、local-pois、
  local-descriptions
- `vercel-labs/skills` — find-skills
- `vercel/ai` — ai-sdk
- `vercel-labs/next-skills` — next-best-practices、next-cache-components
- `vercel-labs/agent-skills` — vercel-react-best-practices、
  vercel-composition-patterns、web-design-guidelines
- `shadcn-ui/ui` — shadcn
- `bobmatnyc/claude-mpm-skills` — drizzle、drizzle-orm
- `rolldown/tsdown` — tsdown
- `better-auth/skills` — better-auth-security-best-practices、
  email-and-password-best-practices、two-factor-authentication-best-practices、
  organization-best-practices、create-auth-skill
- `snarktank/ralph` — prd
- `smithery-ai/cli` — smithery、smithery-ai-cli、smithery-homepage

## Downstream Impact

- **`scripts/sync-skills.sh`** — 无需改。只遍历 `source == "mirror"`，
  custom/official 被跳过（脚本第 12-13、44-45 行）。膨胀不影响。

- **`Makefile` 的 `make list`** — 需改 jq。现分支 official 读 `.plugin`，
  新模型下普通 official 无 `plugin` 会错显 `plugin: null`。改为：official 显示
  `repo`，若有 `plugin` 再附注 `(anthropic plugin: <name>)`。

- **`skills/README.md`** — 更新 official 定义（符合 skills.sh 标准 + `plugin`
  可选字段）与分发语义（普通 official 各处 `pnpx skills add <repo>`；带 `plugin`
  的另可 `claude plugin install`）。

## Testing

- `jq empty skills.json` — 校验 json 合法。
- `make list` — 确认所有 54 条正确分类显示、official 显 repo、defuddle 显官方插件标注。
- `scripts/sync-skills.sh check` 逻辑复核（不实跑网络）— 确认仍只处理 drawio。

## Out of Scope

- 不实装任何 skill（纯总账 + 文档）。
- 不建空 `skills/<name>/` 目录。
- 不精简清单（用户明确暂不精简）。
- 不做 README.md（英）/ README.zh.md（中）同步——本仓库当前无这两份根级 README
  的 skills 章节需求；本次只动 `skills/README.md`。
