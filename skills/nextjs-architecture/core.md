## 项目概述
这是一个基于 React 19 + Next.js 15 + TypeScript + shadcn/ui 的现代化 Web 应用项目模板，采用 Bulletproof React 架构模式。
架构模式: Bulletproof React - 特性驱动、类型安全、测试优先的生产级架构

核心原则:

特性模块化：按功能组织代码，避免扁平结构
单向数据流：shared → features → app，features 之间**禁止**互相导入
类型安全：TypeScript 全覆盖，禁止 any
绝对导入：统一使用 @/* 别名
最小化实现：遵循 MVP 原则，如非必要不进行拓展
