# Sync Docs

文档同步工具，将 skills 和 agents 内容同步到 Fumadocs 文档系统。

## 使用

```bash
# 开发模式运行
pnpm --filter @infra-ai/sync-docs sync

# 或从根目录
pnpm sync:docs
```

## 工作原理

1. 扫描 `/skills` 和 `/agents` 目录
2. 复制 `.md` 文件并转换为 `.mdx`
3. 生成索引页面
4. 输出到 `/packages/docs/content/docs`
