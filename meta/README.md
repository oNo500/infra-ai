# meta/ — 意图源与 prompt

- `prompts/` — 每类资产两份 AI 行为契约（`<类>-build.md`、`<类>-writeback.md`），
  headless 构建与回写时由 imeta 指针引用；只写 AI 该做的
- `rules/`、`skills/`、`templates/` — 意图源，一资产一份，永久保留

## 元指令格式

```yaml
---
name: <产物名，与文件名一致，小写连字符>
status: stub | ready
scope: global | "<glob>"        # 仅 rule
tags: [<tag>, ...]              # 仅 rule；ready 必填，词表见 meta/tags.json
requires: [<rule-name>, ...]    # 仅 rule，可选；只写任何组合下都成立的固有依赖
---
```

- `stub` — 意图占位，内容待补全，禁止构建
- `ready` — 规格完整，可构建
- `scope: global` — 产物落 `rules/global/`（无条件加载）；
  `scope: "<glob>"` — 产物落 `rules/scoped/`，glob 写进产物 `paths` frontmatter
- `tags` 取值必须在 `meta/tags.json` 词表内（分面组织，互斥面内至多一值；
  新 tag 先入词表再使用，与内容同一提交）；tags/requires 是管理元数据，
  不参与构建 hash——补 tag 不会触发重建
- 按项目组合见根部 `profiles.json`（显式清单，`imeta status` 校验
  存在性、requires 闭包、constitution 必含）

正文写意图与要求：目标、约束、示例，可附内容素材。元指令没有终态，
产物存在与否看目标位置与 `artifacts.lock.json`。

## 新增资产

1. 在 `meta/<类>/<name>.md` 写元指令（`stub` 起步）
2. 补全为 `ready` 后 `imeta build <name>`（或 TUI 选中按 `b`）

流程细节看 `imeta --help` 与 run log（`.imeta/logs/`）；回写与分发纪律见
`.claude/rules/architecture.md`。

`templates/` 下无元指令源的既有模板（CLAUDE.md、settings.json、mcp.md）
是手写模板，imeta 不追踪；改到谁再为谁补建元指令。
