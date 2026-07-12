# rule 构建规则

`meta/rules/*.md` 是 rule 元指令；本文件是从元指令构建 rule 的规则。
产物品质由本文件决定：修改前先与用户确认，不做顺手编辑。

元指令是源，永久保留；`rules/global|scoped/<name>.md` 是构建产物，可随时按
新的风格标准重新构建。

## 元指令格式

```yaml
---
name: <产物名，与文件名一致>
target: rule
status: stub | ready
scope: global | "<glob>"
---
```

- `stub` — 意图占位，内容待补全
- `ready` — 规格完整，可构建
- `scope: global` — 产物落 `rules/global/`，不写 `paths`
- `scope: "<glob>"`（如 `"src/api/**/*.ts"`）— 产物落 `rules/scoped/`，
  glob 写进产物的 `paths` frontmatter

正文写意图与要求：目标、约束、示例，可附内容素材。元指令没有终态，
产物存在与否看目标位置。

## 构建

触发：`imeta` 选中资产按 `b`（headless 构建），或对 Claude 说「构建 `meta/rules/<name>.md`」。

1. 读元指令；`status: stub` 先与用户对齐意图、补全成 `ready` 再继续
2. 过 `templates/rule.md` 的检查清单（该不该独立成文件、要不要 `paths`）
3. 按 `scope` 生成产物到 `rules/global/<name>.md` 或 `rules/scoped/<name>.md`
4. 写法约束跟着落点走：
   - `global/` — 无条件进上下文，必须精简、姿态化，每主题一文件
   - `scoped/` — 按 glob 触发加载，允许更细更长
5. 语言：正文以中文为主，术语、命令、代码与标识保留英文

## 分发

手动复制到目标项目 `.claude/rules/`（分发能力属使用端 CLI，待立项；不用 symlink，路径不可靠）。
源只在本仓改，下游副本不回改；有价值改动回写元指令、重建后重新 copy。

## 回写纪律

- 意图变更：先改元指令，再重新构建产物
- 直接在产物上做了有价值的修改：必须回写元指令，否则下次重建丢失
