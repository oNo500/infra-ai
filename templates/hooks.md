# Hooks

Claude Code hooks 配置模板：必须确定性发生的行为用 hooks 强制——hook 是进程执行，
模型跳不过；写成 CLAUDE.md 指令则指望模型记得，上下文压力下必然遗漏。

实例化方式：把下面各片段合并进目标项目 `.claude/settings.json` 的同一个 `hooks`
键下，并替换两个占位符：

- `[COMPACT_RULES_PATH]` — 压缩时需保留的关键规则文件路径
- `[NOTIFY_COMMAND]` — 平台相关的桌面通知命令

## PostToolUse 自动格式化

Write/Edit 落盘后立即格式化。Why：格式化写成 CLAUDE.md 规则，在上下文压力下
跳过率约 44%（Vercel 数据）；hook 让它不依赖模型自觉。

格式化命令按本仓工具链选型写死：`.ts/.tsx/.js/.jsx` 走 oxfmt，`.py` 走
`ruff format`。

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "f=$(jq -r '.tool_input.file_path // empty'); case \"$f\" in *.ts|*.tsx|*.js|*.jsx) oxfmt \"$f\" >/dev/null 2>&1;; *.py) ruff format \"$f\" >/dev/null 2>&1;; esac"
          }
        ]
      }
    ]
  }
}
```

## PreCompact 关键规则注入

每次压缩（手动 `/compact` 与自动压缩都触发）把 `[COMPACT_RULES_PATH]` 的内容
注入压缩提示。Why：会话中途写入的规则不显式注入就不会在压缩后保留。

```json
{
  "hooks": {
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "jq -n --rawfile rules \"[COMPACT_RULES_PATH]\" '{hookSpecificOutput: {hookEventName: \"PreCompact\", additionalContext: $rules}}'"
          }
        ]
      }
    ]
  }
}
```

规则文件用指令格式，不用散文体：一行一条可执行约束，压缩摘要才能原样带走。

## Stop 桌面通知

会话停止时发桌面通知，长任务不用盯终端。通知命令平台相关，留占位实例化
（macOS 用 `osascript -e 'display notification ...'`，Linux 用 `notify-send`）。

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "[NOTIFY_COMMAND]"
          }
        ]
      }
    ]
  }
}
```

## 使用纪律

不该用 hook 的场景：

- linter 已强制的风格——重复强制只制造噪音
- 条件性行为——用 skill + 写好 description，让模型按语境判断
- 需要网络调用的阻塞操作——PreToolUse 同步阻塞工具调用，慢请求拖住整个会话

exit code 约定：

- `0` 通过；stdout 若非空会按 JSON 解析为 additionalContext
- `2` 阻断工具调用（仅 PreToolUse 生效），stderr 展示给 Claude
- 其他非零为非阻断警告

stdout 必须纯 JSON 或为空：shell 配置文件的输出（如 `~/.zshrc` 里的 echo）混进
stdout 会导致 JSON 静默解析失败，hook 看似生效实则丢弃。命令用 argv 数组形式
直接执行、不经过加载配置的交互式 shell。
