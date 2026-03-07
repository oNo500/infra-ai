# CLAUDE.md 填写指南（monorepo 根）

使用 `assets/CLAUDE-monorepo-template.md`，填写后输出到 `CLAUDE.md`。

## 概要

你正在生成 monorepo 根目录的 `CLAUDE.md`，提供跨包的全局视野。**最后生成**，确保所有被引用的文档已存在。

按以下流程操作：

1. 扫描 `packages/`、`apps/`、`libs/` 等目录，识别所有子包
2. 读取根 `package.json` scripts，提取统一命令
3. 填充模板，写入 `CLAUDE.md`

## 填写要求

- **包结构表**：只列有独立职责的包；纯配置包（如 `config-eslint`、`tsconfig`）可省略
- **统一命令**：从根 `package.json` scripts 中取，使用实际脚本名
- **单独启动命令**：以实际包管理器过滤语法为准
  - pnpm：`pnpm --filter @scope/name dev`
  - nx：`nx run name:dev`
  - turbo：`turbo run dev --filter=name`
- **跨包约束**：只写真实存在的，从 tsconfig、eslint 配置、CI 流程中推断
- 删除不适用的章节

## 输出前验证

- 无残留的 `[ALL_CAPS]` 占位符
- 所有命令已在根 package.json 中验证存在
- 包路径与实际目录结构一致
- `<!-- -->` 注释删除
