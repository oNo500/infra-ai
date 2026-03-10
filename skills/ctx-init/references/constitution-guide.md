# Constitution 填写指南

## 概要

你正在生成 `.claude/rules/constitution.md`，这是项目核心原则文件。**无 frontmatter paths**，始终被 Claude Code 加载。

参考模板：`assets/constitution-template.md`。

## 执行流程

1. 从 README、package.json、配置文件推断项目背景
2. 为每个占位符收集/推导值：
   - 若对话中用户提供了值，使用它
   - 否则从仓库上下文推断
3. 填写模板，写入 `.claude/rules/constitution.md`

## 默认必包含原则

始终包含以下规则（可按项目实际调整措辞）：

- **Library-First**：优先用成熟库，不重复造轮子
- **MVP-First**：功能最小化，只做必须的
- **Test-Driven Development**：先写测试，迫使在编码前想清楚 API 设计与边界条件
- **Functional Programming First**：优先使用纯函数、不可变数据
- **测试就近原则**：测试文件与源文件放在同一目录
- **环境变量**：所有配置通过环境变量注入，不硬编码
- **TypeScript 类型**：禁止双重断言（as X as Y）
- **禁止 emoji**：源代码中不得使用 emoji，除非有明确要求

原则数量按项目实际需要增减，不必拘泥于模板数量。

## 格式要求

- 无 frontmatter（constitution 始终加载，不需要 paths）
- 每个原则：简洁名称、不可商议规则（MUST/禁止等声明性语言）、必要时附理由
- 避免模糊语言（"应该" → "MUST" 或 "禁止"）

## 输出前验证

- 无残留的 `[ALL_CAPS]` 占位符
- 原则是声明性的、可测试的
- 无尾随空格
