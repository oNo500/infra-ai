# iuse 查询层与自由组合设计

日期：2026-07-18
状态：已批准（用户裁决：catalog 方案 + lock 显式集合语义 + 双轨入口）

## 背景与痛点

iuse 现有命令面（init/profiles/status/update/diff）全部围绕拼装与对账，
没有面向内容的查询入口。四类场景全部不便：

- 选型时看不到内容：init 前只有 profile 名与 rule 名清单，rule 写了什么、
  适不适合当前项目，要去源仓翻文件
- 没法按条件找资产：tags 体系在 meta/ 里，iuse 暴露不出来
- 装完后不知道装了什么：已初始化项目里回看「装了哪些、每条干嘛的、
  当时为何排除某条」不直观
- AI/脚本侧取数难：agent 需要准确读到全部资产内容与状态，
  才能决定如何组合与更新；现有 --json 覆盖面不够

用户裁决的入口形态：TUI 给人（左右分屏浏览），CLI 给 AI
（完整机器可读，`--json` 全覆盖）。同轮一并做自由组合：
AI/人查完后可不经 profile 直接选 rule 拼装与增减，profile 退化为预设起点。

## 目标

- 查询成为 iuse 的一等维度：list（条件筛选）、show（单条全文）
- 自由组合：init 可直选 rules；update 可增减单条；lock 的 rules
  集合成为下游安装事实的 SSoT
- 上游 profile 演进以「可选新增」形式呈现，不再自动进入更新计划
- TUI 新增 browse 视图（左列表右正文），与 init/status 流打通

## 非目标（YAGNI）

- 不做全文搜索索引；CLI 用 `--grep` 逐条匹配即可（16 条规模）
- TUI 内不做文本搜索输入框，先做 tag 过滤与列表浏览；搜索留给 CLI
- 不动 skills 分发（尚未立项）；catalog v1 只含 rules——templates
  是三个固定文件，无查询需求，维持现状
- 不做 rule 版本化/依赖求解；requires 边仍只在源端校验

## 决策一：catalog 产物（查询数据来源）

源端新增构建产物 `catalog.json`（仓库根，与 profiles.json 并列），
由 imeta 生成。它是 meta frontmatter、tags.json、profiles.json 的
机器可读派生视图——SSoT 仍是 meta，catalog 是产物，
故嵌入派生数据（tags 词表、profile 隶属）不构成双账。

```json
{
  "generatedAt": "<ISO>",
  "tags": { "<facet>": { "exclusive": true, "values": { "<tag>": "<中文名>" } } },
  "rules": {
    "<name>": {
      "description": "<一句话，面向使用者>",
      "tags": ["ts", "testing"],
      "scope": "global",
      "path": "rules/global/<name>.md",
      "profiles": ["nextjs-app", "react-spa"]
    }
  }
}
```

- 生成时机：并入 `imeta build` 流程（任何 rule 构建后重新生成整份 catalog）；
  另提供 `imeta catalog` 显式重建入口，进动作注册表（actions.ts 红线）
- 校验：`imeta status` 增加 catalog 新鲜度检查——catalog 内容与
  meta frontmatter/tags.json/profiles.json 派生结果不一致时报 stale
- iuse 端：所有查询只读 catalog + 产物正文文件，不解析 meta/

### description 回写（前置工作）

rule 目前没有面向使用者的 description。给 16 条 rule 元指令的
frontmatter 增加 `description:` 一行（一句话，中文，说明该 rule
管什么、适用什么项目）。AI 起草、人审后回写；rule-build 契约
（meta/prompts/rule-build.md）与 meta/README.md 同步补充该字段说明。
imeta status 对缺 description 的 ready rule 报警，catalog 生成时缺失即失败。

## 决策二：lock 显式集合语义（自由组合的账）

`DownstreamLock` 字段不变（rules map 本来就是显式集合），改解读语义：

- `lock.rules` 是下游安装事实的 SSoT：update 只对账集合内的 rule
  （synced/modified/outdated/missing 状态机不变）
- `profile` 字段降为 informational：仅记录 init 时的种子，
  update 不再用 `profiles.json[profile].rules` 推目标集合
- 上游 profile 新增而集合外、又非 excluded 的 rule，呈现为新状态
  **available**（可选新增）：status 里单列一段提示，update 计划不含它，
  `--add` 或 TUI 勾选后才入集合
- 集合外、非 excluded、也不在种子 profile 定义内的 catalog 资产为
  **uninstalled**（只在 list/browse 出现，status 不列）；
  `--rules` 直选初始化的目标（lock.profile 为 `-`）没有种子 profile，
  其集合外资产一律 uninstalled
- `excluded` 语义不变：对 available 的永久闸门（「别再提示我」）；
  `--add` 一个 excluded 的 rule 即回补（从 excluded 移除并安装）
- 无 schema 迁移：旧 lock 直接按新语义解读即可

行为差异说明：改造前上游 profile 加新 rule 会以 outdated/missing
出现在 update 计划里并被自动安装；改造后同一情形是 available，
需显式 --add。这是有意的收敛：安装集合只增于显式动作。

## 命令面

新增：

- `iuse list [--tag a,b] [--grep <kw>] [--json]` — 列资产：名称、
  description、tags、scope；已初始化目标上附加每条的安装状态
  （synced/modified/outdated/missing/available/excluded/uninstalled）。
  `--tag` 逗号分隔取交集；`--grep` 对 name/description/正文做子串匹配。
  恒退 0。
- `iuse show <name> [--json]` — 单条元数据（catalog 条目 + 安装状态）
  加产物全文。未知名退 1。

改造：

- `iuse init --rules a,b,c` — 与 `--profile` 互斥，直选集合拼装；
  lock.profile 记 `-`（无种子）。`--profile p --exclude x` 形态保留。
- `iuse update --add a,b --remove c,d` — add 覆盖 available 新增与
  excluded 回补两种情形（现有 `--include` 併入 `--add`，直接改名，
  无兼容层——iuse 尚无本仓之外的使用者）；remove 即移入 excluded
  并删除副本（现有排除语义）。与 `--force/--dry-run` 正交。
- `iuse status` — 输出增加 available 段；excluded 段维持现状。
  available 不影响退出码（有待处理项才退 1，available 只是提示）。

全部命令 `--json` 输出完整结构化数据；帮助文本中文为主，沿用现有风格。

## TUI

新增 browse 视图，左右分屏：

- 左栏：资产列表（来自 catalog），行内显示 name + 安装状态标记；
  `t` 循环 tag 面过滤，上下移动
- 右栏：选中资产的 description、tags 与产物正文（滚动截断沿用
  diff-view 的 200 行策略）
- 动作：未初始化目标上 `space` 多选、`enter` 进 init 计划预览
  （等价 `init --rules 选中集`）；已初始化目标上对 available/uninstalled
  行 `a` 加入、对已装行 `x` 移除，动作即时进 update 计划预览走既有
  执行流（含 diff 邂逅与覆盖/忽略裁决）
- 入口路由：bare 跑未初始化 → browse 起步（替代现在直接进 profile
  picker；picker 保留为 browse 内 `p` 键的快捷预设选择）；
  已初始化 → status 起步，`b` 切到 browse，`esc` 返回

## 错误处理

- catalog 缺失（旧源仓/未重建）：iuse 查询命令报错并提示在源仓跑
  `imeta catalog`；init/update 不依赖 catalog 的路径照常工作
- catalog 与产物不一致（名称指向不存在的文件）：show/list 对该条
  标注 broken 并继续，退出码不变；不静默吞
- `--rules` 与 `--profile` 同时给出：参数错误退 2（沿用 citty 约定）
- `--add`/`--remove` 名字不在 catalog：退 1，报未知名清单

## 测试策略

- core 纯函数单测：catalog 读取与校验、安装状态机（含 available）、
  add/remove 集合运算、list 过滤逻辑
- CLI 层：`--json` 输出快照断言；exit code 语义
- imeta 端：catalog 生成与 status 新鲜度校验单测
- TUI：沿用 press()/waitFor 夹具（含丢键防护与帧转储）测 browse
  浏览、tag 过滤、勾选进计划、a/x 动作全链路
- parity.test.ts：imeta catalog 动作进注册表后 CLI/TUI 对齐校验

## 实施切分建议（供 writing-plans 参考）

1. description 回写 + rule-build 契约更新（源端数据补齐）
2. imeta catalog 生成 + status 校验 + 动作注册表
3. iuse core：catalog 读取、状态机 available、集合运算
4. CLI：list/show + init --rules + update --add/--remove
5. TUI：browse 视图与入口路由
