# Context7

直接从源头获取最新的第三方库文档。消除因训练数据过时而产生的幻觉 API 签名。

**激活范围：全局** —— 在任何涉及第三方库的项目中都有用。

## 安装

```bash
claude mcp add context7 -- npx -y @upstash/context7-mcp@latest
```

## 用法

通过自然语言调用："用 context7 拉取 Prisma `findMany` 的文档"。
Context7 会解析出对应的库，获取最新文档，并注入到上下文中。

## 上下文开销

每次激活约 8k token。只要你在使用的库的 API 可能在模型训练截止日期之后发生过变化，
这个开销就是值得的。
