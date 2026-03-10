# Architecture Rules 填写指南

## 概要

你正在生成 `.claude/rules/architecture.md`，包含项目技术栈、目录结构、编码规范。

**无 frontmatter paths**（始终加载）。

## 选择基础模板

根据 Step 1 扫描结果：

| 项目类型 | 参考文件 |
|----------|----------|
| 前端（Next.js/React） | [assets/frontend-rules-example.md](../assets/frontend-rules-example.md) |
| 后端（NestJS） | [assets/nestjs-rules-example.md](../assets/nestjs-rules-example.md) |
| 其他 | [assets/architecture-template.md](../assets/architecture-template.md) |

## 各章节填写要求

- **Tech Stack**：从 `package.json` 扫描，按 MECE 原则分类，忽略版本号
- **Architecture**：以示例目录结构为基础，按实际项目调整；画出真实的目录树
- **Coding Conventions**：只记录工具无法自动检测的约定（linter 能做的不要写）

## 输出前验证

- 无残留的 `[ALL_CAPS]` 占位符
- 不适用的章节整节删除
- `<!-- -->` 注释删除
- 目录结构与实际项目一致
