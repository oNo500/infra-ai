# MCP server 使用纪律

单个 server 说明见同目录各文件。跨 server 的预算与取舍原则：

## 预算

- 同时启用的 server 不超过 5-6 个：可见工具超过约 50 个后，
  模型选错工具的概率明显上升
- 每个 server 约 10k token 上下文开销（5 个约占 200k 窗口的 27%），
  启用前先问这次会话用不用得上

## 作用域拆分

- 全局启用：context7、fetch 这类任何项目都可能用到的
- 项目级启用：GitHub、数据库、Playwright 这类绑定具体项目的

## MCP 是最后手段

- 同等能力下优先 CLI 或 skill：CLI 零常驻开销，skill 懒加载
- 选 server 认厂商官方维护版（Upstash Context7、Microsoft Playwright、
  GitHub 官方），避开已归档的参考实现（modelcontextprotocol/servers
  大部分已归档）
