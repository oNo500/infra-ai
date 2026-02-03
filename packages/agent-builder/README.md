# Agent Builder

将分散的规则文件编译为统一的 AGENTS.md 文档。

## 使用

```bash
# 构建单个 agent
pnpm build nextjs-architecture

# 构建所有 agents
pnpm build:all
```

## 数据流转

```
┌──────────────────────────────────────────────────────────────┐
│                        构建流程                               │
└──────────────────────────────────────────────────────────────┘

  agents/{name}/metadata.json        skills/{name}/rules/*.md
         │                                    │
         │ 读取                               │ 并行解析
         ▼                                    ▼
    ┌─────────┐                         ┌──────────┐
    │ 元数据   │                         │ 规则列表  │
    │ sections │                         │ 章节映射  │
    └─────────┘                         └──────────┘
         │                                    │
         │                                    │
         └──────────────┬─────────────────────┘
                        │
                        ▼
                 ┌──────────────┐
                 │  按章节分组   │
                 │  排序 + ID   │
                 └──────────────┘
                        │
                        ▼
                ┌───────────────┐
                │ 生成 markdown │
                └───────────────┘
                        │
                        ▼
           agents/{name}/AGENTS.md
```

## 架构

```
skills/{agent-name}/
  rules/*.md              # 规则文件

agents/{agent-name}/
  metadata.json           # 元数据配置
  AGENTS.md              # 生成的文档（自动）
```

## metadata.json 格式

```json
{
  "title": "Agent Name",
  "version": "1.0.0",
  "organization": "Your Org",
  "abstract": "简介",
  "references": ["https://..."],
  "sections": [
    {
      "id": "prefix",
      "title": "章节名称",
      "impact": "CRITICAL",
      "description": "章节描述"
    }
  ]
}
```

## 规则文件命名

规则文件按前缀自动分组：

```
prefix-rule-name.md  →  匹配到 sections[].id = "prefix"
```

## 添加新 agent

1. 创建 `skills/{name}/rules/*.md`
2. 创建 `agents/{name}/metadata.json`
3. 在 `src/config.ts` 的 `agentNames` 中添加名称
4. 运行 `pnpm build {name}`
