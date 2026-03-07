# Project Context 填写指南

填写后输出到 `.claude/docs/project-context.md`。

## 概要

根据项目类型，直接以对应示例为基础，按实际情况修改：

- **前端（Next.js / React）** → 参考 [assets/frontend-context-example.md](../assets/frontend-context-example.md)
- **后端（NestJS）** → 参考 [assets/nestjs-context-example.md](../assets/nestjs-context-example.md)
- **其他类型** → 使用 [assets/project-context-template.md](../assets/project-context-template.md) 从头填写

从仓库扫描信息：`package.json`、`tsconfig.json`、目录结构、README、配置文件。

## 各章节填写要求

- **Project Overview**：1-3 句话，从 README 或 package.json description 推断
- **Tech Stack**：从 `package.json` 扫描，按 MECE 原则分类，忽略版本号
- **Architecture**：以对应示例的目录结构为基础，按实际项目调整
- **Coding Conventions**：跳过 linter/formatter 能自动强制的规则；只记录工具无法检测的约定
- **Development Workflow**：按 MECE 原则梳理开发场景，每个场景是一组有序步骤；命令从 `package.json` scripts 中取
- **Testing Rules / Modification Rules**：声明性、可测试，避免模糊语言（"应该" → "MUST"/"禁止"）

## 输出前验证

- 无残留的 `[ALL_CAPS]` 占位符
- 不适用的章节整节删除，`<!-- -->` 注释删除
- 所有命令已在 `package.json` scripts 中验证存在
