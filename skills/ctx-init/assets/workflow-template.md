# [PROJECT_NAME] - Workflow

## 初始化项目

```bash
[install command]       # 安装依赖
cp .env.example .env    # 配置环境变量
[dev command]           # 启动开发服务器
```

## 开发新功能

```bash
git checkout -b feat/[name]
[dev command]           # 开发
[test command]          # 验证
[lint command]          # 质量检查
```

## 提交前检查

```bash
[lint:fix command]
[typecheck command]
[test command]
```

## 生产构建

```bash
[build command]
[start command]
```

## Modification Rules

- **MUST read the file before editing**
- **Prefer editing existing files over creating new ones**
- **Confirm before irreversible operations (delete, force push)**
- **注释说明"为什么"，不说明"是什么"**
