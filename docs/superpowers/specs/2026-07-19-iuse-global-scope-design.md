# iuse 全局 scope 只读对账设计

日期:2026-07-19
状态:已批准(用户裁决:全局只读检测 + 手动纪律;scope 视角:全局与项目同构)

## 背景与裁决

此前挂起的「全局层通路」问题(工具通路 vs 手动纪律)由用户定案为折中:

- iuse MAY 检测 `~/.claude` 全局层与中心源的漂移,输出对账结果与修改建议
- iuse MUST NOT 写入/覆盖/修改 `~/.claude` 下任何文件;全局层变更永远手动执行
- 项目级 init/update 的写入边界不变

设计视角(用户补充):全局与项目只是 scope 之别——项目级该有的能力,
全局在读侧同构拥有。这与 Claude Code 自身的配置分层一致:
user scope(`~/.claude/`)、project scope(`.claude/`)叠加加载。
iuse 的 global 即 Claude 的 user scope;帮助文本与文档注明该映射。

## 目标

- 读命令全线支持 `--global`:`status --global`、`diff --global`、
  `list --global`,机器复用,target root 换成 `~/.claude`
- 源仓根新增 `globals.json` 账:声明全局层应装的 rule 集
  (扮演全局 scope 的 profile)
- `status --global` 对每条待处理项输出建议的手动命令
- 双层重复检测:同一 rule 同时存在于全局层与项目层时报 duplicate
  (Claude 叠加加载会读两遍,上下文浪费且版本可能漂移)

## 非目标(YAGNI)

- 写命令不做 `--global`:无 `init --global`/`update --global`,
  连 suggest-only 模式也不做——`status --global` 的建议命令已覆盖需求,
  dogfooding 后有感再议
- local scope(本机差异层)不建模
- 全局 CLAUDE.md 不进检测:个人文件、无源基准,瘦身是手动编辑任务
- 全局层不建 lock:两态对账不需要基线,且写 `~/.claude` 被裁决禁止

## 账:globals.json

源仓根,与 profiles.json 并列:

```json
{
  "rules": ["markdown"]
}
```

- `imeta status` 校验:globals.json 引用的 rule 必须存在且 ready
  (复用 profile 校验的同类逻辑);格式坏/名字未知即 violation
- 初始内容由用户手定(当前全局层现状:markdown.md 有源对应;
  agent-browser.md 无源资产,属 unmanaged)

## 对账语义(全局 scope)

全局无 lock 基线,状态机是两态 + 例外,与项目级的五态有意不同:

- **synced**:`~/.claude/rules/<name>.md` 内容与源产物一致
- **differs**:存在但内容不同(无基线,不区分 modified/outdated;
  建议里给 `iuse diff --global --rule <name>` 看差异)
- **missing**:globals.json 声明但全局层无此文件
- **unmanaged**:`~/.claude/rules/` 有而 globals.json 未声明——
  只提示不报错,不影响退出码
- **duplicate**(跨层检测):rule 同时装在全局层与当前项目
  (项目 lock.rules 含同名)——提示建议从某一层移除;
  仅在项目目标已初始化时检测,附加在 status(项目与全局两侧)输出

退出码:有 differs/missing 退 1;仅 synced/unmanaged 退 0。
duplicate 计提示,不影响退出码(两层都是有效安装,收敛方向由人定)。

## 命令面

- `iuse status --global [--source ...] [--json]`:逐条状态 +
  每条 differs/missing 附建议命令行,如:
  `cp <源仓>/rules/global/markdown.md ~/.claude/rules/markdown.md`
- `iuse diff --global [--rule <name>]`:全局副本 vs 源产物,
  复用现有 diff 引擎;对账集合 = globals.json 声明集
- `iuse list --global`:catalog 全量 + 全局安装状态标注
  (synced/differs/missing/unmanaged 之外的 catalog 条目为 uninstalled)
- `--global` 与 target positional 互斥(给了 target 又给 --global 退 2)
- 项目级 `iuse status`(不带 --global)在目标已初始化且检测到
  duplicate 时,末尾附一行提示(不改变项目退出码)

## 实现要点

- target root 参数化:核心函数已接受 target 路径,`--global` 在 CLI 层
  解析为 `join(ctx.home, '.claude')`,并切换「期望集来源」:
  lock → globals.json(读源仓根,缺失时报错提示在源仓建立)
- 全局副本路径:`~/.claude/rules/<name>.md`(与项目 `.claude/rules/` 同名规则)
- 绝不写:全局路径上不存在任何 write 调用;测试断言对账后
  `~/.claude`(fixture 中以临时目录模拟 home)无任何 mtime/内容变化

## 测试策略

- core 单测:globals 对账状态机(四态 + duplicate)、建议命令生成、
  globals.json 缺失/坏格式/未知名
- imeta 端:globals.json 校验进 status
- CLI:--global 三命令的 --json 快照与退出码;--global 与 target 互斥
- 只读不变量:fixture home 目录对账前后逐文件 hash 相等
