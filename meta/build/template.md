# template 构建规则

`meta/templates/*.md` 是 template 元指令；本文件是从元指令构建 template 的规则。
产物品质由本文件决定：修改前先与用户确认，不做顺手编辑。

元指令是源，永久保留；`templates/<name>.md` 是构建产物，可随时按新的标准重新构建。
`templates/` 下没有 meta 源的既有模板（CLAUDE.md、settings.json 等）是手写模板，
改到谁再为谁补建元指令。

## 元指令格式

```yaml
---
name: <产物名，与文件名一致>
target: template
status: stub | ready
---
```

- `stub` — 意图占位，内容待补全
- `ready` — 规格完整，可构建

正文写意图与要求：模板用途、必须覆盖的板块、占位符原则，附内容素材。
产物落 `templates/<name>.md`，保留 `[ALL_CAPS]` 占位符。

## 构建

触发：`meta` 选中资产按 `b`（headless 构建），或对 Claude 说「构建 `meta/templates/<name>.md`」。

1. 读元指令；`status: stub` 先与用户对齐意图、补全成 `ready` 再继续
2. 生成产物到 `templates/<name>.md`，占位符只留项目间真正会变的部分

## 分发（实例化）

模板不 copy 即用（区别于 `rules/` 的照搬分发）：结合目标项目事实填全部占位符后，
落元指令声明的目标位置（如 architecture 落目标项目 `.claude/rules/architecture.md`）。
`scripts/init-project.sh` 脚手架新项目时一并实例化。

## 回写纪律

- 意图变更：先改元指令，再重新构建产物
- 直接在产物上做了有价值的修改：必须回写元指令，否则下次重建丢失
