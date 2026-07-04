# [MCP Server 名称]

[一到两句话：这个 MCP 做什么，解决什么问题。]

**激活范围：全局 | 项目级** —— [说明适用条件：所有项目都装，还是只有满足某个条件的项目才装]。

## 安装

[先核实：Anthropic 官方插件目录（`anthropics/claude-plugins-official`）是否已收录此 server。
自维护工具在 `plugins/`，第三方 server 在 `external_plugins/`：]

```bash
gh api repos/anthropics/claude-plugins-official/contents/external_plugins --jq '.[].name' | grep -i [server-name]
# 命中后查看该目录，确认官方给出的安装方式：
gh api repos/anthropics/claude-plugins-official/contents/external_plugins/[server-name]
```

若已收录，优先使用官方给出的安装方式并在此注明出处（仓库路径）；
若未收录，使用下面的通用 npx 方式，不要臆测官方是否收录。

```bash
claude mcp add [server-name] -- npx -y [package-name]
```

[如需环境变量/token，在此追加：]

```bash
export [ENV_VAR_NAME]=<your-value>
```

## 配置 / 用法

[二选一或都写，取决于该 server 是否需要 .mcp.json 配置：]

添加到 `.mcp.json`（真实凭证放 `.env.local`，切勿提交）：

```json
{
  "mcpServers": {
    "[server-name]": {
      "command": "npx",
      "args": ["-y", "[package-name]"],
      "env": { "[ENV_VAR_NAME]": "${[ENV_VAR_NAME]}" }
    }
  }
}
```

或者，通过自然语言直接调用：

```
[一个具体的调用示例]
```

## [可选] 工具集范围限定 / 何时激活 / 何时不激活

[仅当该 server 有取舍需要说明时写这一节，例如：
- 工具集太多需要按 toolsets 限定
- 有更轻量的替代方案（如内置权限、CLI 工具）
- 明确的适用/不适用场景]

## 安全性

[仅当该 server 有需要强调的安全边界时写，例如只读限制、权限范围。没有特殊说明可省略此节。]

## 上下文开销

约 [X]k token[，加上/随 ... 变化]。
