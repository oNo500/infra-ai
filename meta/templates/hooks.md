---
name: hooks
status: ready
---

# hooks

Claude Code hooks 配置模板：必须确定性发生的行为用 hooks 强制
（进程执行，模型跳不过），不写成 CLAUDE.md 指令指望模型记得。
产物是一份带 `[ALL_CAPS]` 占位符的配置文档，分发时结合目标项目
实例化进 `.claude/settings.json`。

## 要求

产物覆盖三个 must-have hook（附 settings.json 片段）与使用纪律：

- PostToolUse 自动格式化：Write/Edit 命中 `.ts/.tsx/.js/.jsx` 走 oxfmt、
  `.py` 走 `ruff format`（本仓工具链选型，写死不留占位）；
  Why：格式化写成 CLAUDE.md 规则在上下文压力下跳过率约 44%（Vercel 数据）
- PreCompact 关键规则注入：每次压缩（手动/自动）把 `[COMPACT_RULES_PATH]`
  内容注入压缩提示；Why：会话中途写入的规则不显式注入就不会在压缩后保留；
  规则文件用指令格式不用散文体
- Stop 桌面通知：会话停止时通知，命令平台相关留占位 `[NOTIFY_COMMAND]`

使用纪律与坑：

- 不该用 hook 的场景：linter 已强制的风格（重复强制制造噪音）、
  条件性行为（用 skill + 好的 description）、需要网络调用的阻塞操作
  （PreToolUse 同步阻塞工具调用）
- exit code 约定：0 通过（stdout JSON 解析为 additionalContext）；
  2 阻断工具调用（仅 PreToolUse，stderr 展示给 Claude）；其他非零为
  非阻断警告
- stdout 必须纯 JSON 或为空：shell 配置文件输出（`~/.zshrc`）会导致
  JSON 静默解析失败，命令用 argv 数组形式避免加载 shell 配置

## 产物要求

- 占位符只留项目间真正会变的部分（COMPACT_RULES_PATH、NOTIFY_COMMAND），
  格式化命令按本仓选型写死
- 素材源：notes 仓 `00-inbox/hooks-渐进增强.md`
