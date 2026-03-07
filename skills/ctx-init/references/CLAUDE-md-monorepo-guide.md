# CLAUDE.md 填写指南（monorepo 根）

- 统一命令从根 `package.json` 脚本中取，使用实际脚本名
- 单独启动命令以实际包管理器过滤语法为准（pnpm `--filter`、nx `run`、turbo `run`）
- 跨包约束只写真实存在的，从 tsconfig、eslint 配置、CI 流程中推断
- 包结构表只列有独立职责的包；纯配置包（如 `config-eslint`）可省略
- 删除不适用的章节
