# Skills Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将约 54 个 skill 的目标态清单记入 `skills.json` 总账，并把 `official` 重定义为「符合 skills.sh 标准」，落到 `Makefile` 与 `skills/README.md`。

**Architecture:** 三分类总账（custom / mirror / official）。official 最小化（name/source/repo，Anthropic 官方插件加 plugin 字段）。先改数据（skills.json），再改消费方（make list jq），最后改文档（README）。每步用 `jq` 校验合法性、`make list` 观察分类输出作为验证。

**Tech Stack:** JSON、jq、GNU make、bash。

## Global Constraints

- 注释、commit、内容以英文为主（commit message 英文，Conventional Commits）。
- 源代码禁止 emoji。
- 禁止表格，用列表代替（文档写作）。
- `official` 条目只含 `name`/`source`/`repo`；Anthropic 官方插件额外 `plugin`。
- `custom` 条目只含 `name`/`source`；不建空 `skills/<name>/` 目录。
- `mirror` 条目（仅 drawio）保持现状不动。
- 不实装任何 skill；不精简清单。

---

### Task 1: 写入 skills.json 全量总账

**Files:**
- Modify: `skills.json`（当前 1 条 drawio，扩到 54 条）

**Interfaces:**
- Produces: `skills.json` 为合法 JSON 数组，54 条，每条含 `name`/`source`，
  official 含 `repo`（defuddle 另含 `plugin`），mirror（drawio）含
  `repo`/`path`/`commit`/`updated`。`make list` 与 `sync-skills.sh` 消费它。

- [ ] **Step 1: 备份当前 drawio 条目值**

Run: `jq '.[0]' skills.json`
Expected: 输出 drawio 的完整对象（repo=jgraph/drawio-mcp、path、commit=516965c7…、updated=2026-07-04）。记下，Step 2 原样保留。

- [ ] **Step 2: 用完整数组覆写 skills.json**

写入以下内容（drawio 保持 mirror 原值；custom 13 条只 name/source；official 按 repo 分组，defuddle 带 plugin）：

```json
[
  { "name": "drawio", "source": "mirror", "repo": "jgraph/drawio-mcp", "path": "plugins/claude-code/skills/drawio", "commit": "516965c7c49e9ec408529d0b1a653f67814cb920", "updated": "2026-07-04" },

  { "name": "explaining-code", "source": "custom" },
  { "name": "clarify", "source": "custom" },
  { "name": "gitflow-commit", "source": "custom" },
  { "name": "chezmoi-sync", "source": "custom" },
  { "name": "obsidian-cli", "source": "custom" },
  { "name": "obsidian-markdown", "source": "custom" },
  { "name": "obsidian-bases", "source": "custom" },
  { "name": "note", "source": "custom" },
  { "name": "ctx-init", "source": "custom" },
  { "name": "anki-connect", "source": "custom" },
  { "name": "json-canvas", "source": "custom" },
  { "name": "edit-markdown", "source": "custom" },
  { "name": "tailwindcss-icons", "source": "custom" },

  { "name": "agent-browser", "source": "official", "repo": "vercel-labs/agent-browser" },
  { "name": "dogfood", "source": "official", "repo": "vercel-labs/agent-browser" },
  { "name": "skill-creator", "source": "official", "repo": "vercel-labs/agent-browser" },

  { "name": "crawl", "source": "official", "repo": "tavily-ai/skills" },
  { "name": "extract", "source": "official", "repo": "tavily-ai/skills" },
  { "name": "search", "source": "official", "repo": "tavily-ai/skills" },
  { "name": "research", "source": "official", "repo": "tavily-ai/skills" },
  { "name": "tavily-best-practices", "source": "official", "repo": "tavily-ai/skills" },

  { "name": "defuddle", "source": "official", "repo": "anthropics/claude-plugins-official", "plugin": "defuddle" },

  { "name": "firecrawl", "source": "official", "repo": "firecrawl/cli" },

  { "name": "web-search", "source": "official", "repo": "brave/brave-search-skills" },
  { "name": "images-search", "source": "official", "repo": "brave/brave-search-skills" },
  { "name": "news-search", "source": "official", "repo": "brave/brave-search-skills" },
  { "name": "videos-search", "source": "official", "repo": "brave/brave-search-skills" },
  { "name": "suggest", "source": "official", "repo": "brave/brave-search-skills" },
  { "name": "spellcheck", "source": "official", "repo": "brave/brave-search-skills" },
  { "name": "llm-context", "source": "official", "repo": "brave/brave-search-skills" },
  { "name": "answers", "source": "official", "repo": "brave/brave-search-skills" },
  { "name": "local-pois", "source": "official", "repo": "brave/brave-search-skills" },
  { "name": "local-descriptions", "source": "official", "repo": "brave/brave-search-skills" },

  { "name": "find-skills", "source": "official", "repo": "vercel-labs/skills" },

  { "name": "ai-sdk", "source": "official", "repo": "vercel/ai" },

  { "name": "next-best-practices", "source": "official", "repo": "vercel-labs/next-skills" },
  { "name": "next-cache-components", "source": "official", "repo": "vercel-labs/next-skills" },

  { "name": "vercel-react-best-practices", "source": "official", "repo": "vercel-labs/agent-skills" },
  { "name": "vercel-composition-patterns", "source": "official", "repo": "vercel-labs/agent-skills" },
  { "name": "web-design-guidelines", "source": "official", "repo": "vercel-labs/agent-skills" },

  { "name": "shadcn", "source": "official", "repo": "shadcn-ui/ui" },

  { "name": "drizzle", "source": "official", "repo": "bobmatnyc/claude-mpm-skills" },
  { "name": "drizzle-orm", "source": "official", "repo": "bobmatnyc/claude-mpm-skills" },

  { "name": "tsdown", "source": "official", "repo": "rolldown/tsdown" },

  { "name": "better-auth-security-best-practices", "source": "official", "repo": "better-auth/skills" },
  { "name": "email-and-password-best-practices", "source": "official", "repo": "better-auth/skills" },
  { "name": "two-factor-authentication-best-practices", "source": "official", "repo": "better-auth/skills" },
  { "name": "organization-best-practices", "source": "official", "repo": "better-auth/skills" },
  { "name": "create-auth-skill", "source": "official", "repo": "better-auth/skills" },

  { "name": "prd", "source": "official", "repo": "snarktank/ralph" },

  { "name": "smithery", "source": "official", "repo": "smithery-ai/cli" },
  { "name": "smithery-ai-cli", "source": "official", "repo": "smithery-ai/cli" },
  { "name": "smithery-homepage", "source": "official", "repo": "smithery-ai/cli" }
]
```

- [ ] **Step 3: 校验 JSON 合法且条数正确**

Run: `jq empty skills.json && jq 'length' skills.json`
Expected: 无报错，输出 `54`。

- [ ] **Step 4: 校验分类计数**

Run: `jq -r 'group_by(.source) | map("\(.[0].source): \(length)") | .[]' skills.json`
Expected: `custom: 13`、`mirror: 1`、`official: 40`（顺序可能不同）。

- [ ] **Step 5: 校验 drawio 未被改动**

Run: `jq '.[] | select(.name=="drawio")' skills.json`
Expected: repo=jgraph/drawio-mcp、commit=516965c7c49e9ec408529d0b1a653f67814cb920、updated=2026-07-04 原样。

- [ ] **Step 6: Commit**

```bash
git add skills.json
git commit -m "feat(skills): record full target inventory in skills.json"
```

---

### Task 2: 修 make list 支持新 official 模型

**Files:**
- Modify: `Makefile:14-18`（list 目标的 jq）

**Interfaces:**
- Consumes: Task 1 的 skills.json（official 无 plugin 字段，除 defuddle）。
- Produces: `make list` 对 official 显示 repo；有 plugin 时附注官方插件。

**背景：** 现 jq（`Makefile:17`）对 official 取 `"plugin: " + .plugin`，
但新模型下普通 official 无 plugin，会得到 `null`，`+` 运算报错或输出错误。

- [ ] **Step 1: 先跑现状确认 official 会出问题**

Run: `make list 2>&1 | head -20`
Expected: 报错或 official 行显示异常（`plugin: ` 拼接 null）。记录现状。

- [ ] **Step 2: 改 Makefile list 目标的 jq**

将 `Makefile` 第 14-18 行替换为：

```makefile
list: ## List all skills and their source (reads skills.json)
	@jq -r '.[] | "  \(.name)\t[\(.source)]\t" + \
		(if .source == "mirror" then .repo \
		 elif .source == "official" then .repo + (if .plugin then "  (anthropic plugin: " + .plugin + ")" else "" end) \
		 else "local" end)' skills.json | column -t -s "$$(printf '\t')"
```

- [ ] **Step 3: 跑 make list 验证全部 54 条正确显示**

Run: `make list`
Expected: 54 行；custom 行显 `local`；mirror（drawio）显 `jgraph/drawio-mcp`；official 显各自 repo；defuddle 行附 `(anthropic plugin: defuddle)`。无 `null`、无报错。

- [ ] **Step 4: 抽查 official 与 defuddle 行**

Run: `make list | grep -E 'agent-browser|defuddle'`
Expected: `agent-browser` 显 `vercel-labs/agent-browser`；`defuddle` 显 `anthropics/claude-plugins-official  (anthropic plugin: defuddle)`。

- [ ] **Step 5: Commit**

```bash
git add Makefile
git commit -m "fix(skills): make list handles official repo and optional plugin"
```

---

### Task 3: 更新 skills/README.md 的 official 定义与分发语义

**Files:**
- Modify: `skills/README.md`（official 定义段、官方收录段、分发段）

**Interfaces:**
- Consumes: Task 1/2 的最终字段模型与 make list 行为。
- Produces: README 三分类定义与新模型一致。

- [ ] **Step 1: 改三分类定义（README 第 4-11 行区域）**

将开头三类定义（`custom`/`mirror`/`official`）中 official 一条改为：

```markdown
- `official` — 符合 skills.sh 标准，**不在** `skills/` 里，只需 `name`/`repo`，
  靠 `pnpx skills add <repo> -s <name>`。若同时是 Anthropic 官方插件，额外带
  `plugin` 字段，另可 `claude plugin install <plugin>`。
```

- [ ] **Step 2: 改「官方收录 skill」小节标题与内容（README 第 59-68 行区域）**

将该小节改为反映 skills.sh 标准来源，保留 Anthropic 官方插件的 plugin 字段说明：

```markdown
## 标准 skill (official)

上游符合 skills.sh 标准、可 `pnpx skills add` 的 skill。不放进 `skills/`。

往 `skills.json` 加 `{ "name": "<name>", "source": "official", "repo": "<owner>/<repo>" }`。

若同时是 Anthropic 官方插件（如 defuddle），额外带 `plugin` 字段并可 `claude plugin install <plugin>`：

```json
{ "name": "defuddle", "source": "official", "repo": "anthropics/claude-plugins-official", "plugin": "defuddle" }
```
```

- [ ] **Step 3: 改分发段落（README 第 79 行区域）**

将 `official 类不经分发，各处 claude plugin install。` 改为：

```markdown
`official` 类不经本仓库分发——各处自行 `pnpx skills add <repo> -s <name>`；
带 `plugin` 字段的 Anthropic 官方插件另可 `claude plugin install <plugin>`。
上游更新后各处 `pnpx skills update` 拉最新。
```

- [ ] **Step 4: 通读校验一致性**

Run: `grep -n 'official\|plugin\|pnpx skills add' skills/README.md`
Expected: official 定义、官方插件 plugin 字段、分发语义三处均已更新，无残留「官方插件，靠 claude plugin install」旧表述作为 official 的唯一定义。

- [ ] **Step 5: Commit**

```bash
git add skills/README.md
git commit -m "docs(skills): redefine official as skills.sh-standard in README"
```

---

## Notes

- `scripts/sync-skills.sh` 无需改：只处理 `source == "mirror"`，新增的 custom/official 被跳过。计划不含改动它的任务。
- `drizzle` 与 `drizzle-orm` 是同一 skill 的两个别名（清单标「备用入口」），按「暂不精简」两条都保留。
- official 计 40 条：3(agent-browser)+5(tavily)+1(defuddle)+1(firecrawl)+10(brave)+1(find-skills)+1(ai-sdk)+2(next)+3(agent-skills)+1(shadcn)+2(drizzle)+1(tsdown)+5(better-auth)+1(prd)+3(smithery)=40。
