# Project Context 填写指南

使用 `assets/project-context-template.md`，填写后输出到 `.claude/docs/project-context.md`。

## 概要

你正在生成 `.claude/docs/project-context.md`，该文件包含项目的技术细节，供 Claude 在编码时参考。从仓库上下文中推断所有占位符值。

按以下流程操作：

1. 扫描仓库，收集信息：`package.json`、`tsconfig.json`、目录结构、README、配置文件
2. 填充模板占位符
3. 验证输出，写入文件

## 各章节填写要求

- **Project Overview**：1-3 句话说明项目用途、目标用户、核心价值；从 README 或 package.json description 推断
- **Tech Stack**：从 `package.json` 扫描，按 MECE 原则分类；参考维度：Runtime / Framework / Language / Database / Auth / UI / Testing / Toolchain，每个类别一行，只列实际使用的类别，忽略版本号
- **Architecture**：根据项目类型选择对应架构模式，参考模板中的元提示
- **Coding Conventions**：跳过 linter/formatter 能自动强制的规则（缩进、引号、分号等）；只记录工具无法检测的约定（如"文件命名规范"）
- **Development Workflow**：按 MECE 原则梳理开发场景（初始化 / 开发新功能 / 提交前检查 / 生产构建等），每个场景是一组有序步骤；命令从 `package.json` scripts 中取
- **Testing Rules**：声明性、可测试 — 避免模糊语言（"应该" → "MUST"/"禁止"）
- **Modification Rules**：声明性、可测试 — 避免模糊语言

## 输出前验证

- 无残留的 `[ALL_CAPS]` 占位符
- 不适用的章节整节删除，`<!-- -->` 注释删除
- 所有命令已在仓库中验证存在（来自 package.json scripts）
