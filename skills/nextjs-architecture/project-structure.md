# Project Structure

## 项目架构

架构模式：采用 Bulletproof React - 特性驱动、单向依赖的三层架构

三层架构：shared → features → app（单向数据流）

```bash
.
├── src
│   ├── app # App Router（基于文件系统的路由）
│   │   ├── _components
│   │   ├── page.tsx                 # 首页 /
│   │   ├── not-found.tsx            # 404 页面
│   │   ├── provider.tsx             # 客户端 Provider
│   ├── config
│   │   ├── env.ts
│   │   └── paths.ts
│   ├── features     # 功能模块
│   │   ├── auth
│   │   │   ├── assets
│   │   │   ├── api
│   │   │   ├── components
│   │   │   ├── hooks
│   │   │   ├── stores
│   │   │   ├── hooks
│   │   │   ├── types
│   │   │   ├── utils
│   ├── components # shared components
│   │   ├── errors
│   │   │   └── main.tsx
│   │   ├── layouts
│   │   │   └── content-layout.tsx
│   ├── hooks # shared hooks
│   ├── lib  # shared lib 业务行为
│   ├── styles
│   ├── types # shared types
│   │   └── api.ts
│   └── utils # shared utils 纯逻辑/无状态
````

核心规则：单向依赖 `shared -> features -> app`，features 之间**禁止**互相导入

