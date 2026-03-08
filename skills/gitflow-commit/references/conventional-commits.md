---
name: conventional-commits
description: Conventional Commits 1.0.0 规范参考
---

# Conventional Commits

格式：`<类型>[可选范围]: <描述>`

```
<类型>[可选范围]: <描述>

[可选正文]

[可选页脚]
```

## 类型

| 类型 | 用途 |
|------|------|
| `feat` | 新功能（对应 MINOR 版本） |
| `fix` | 缺陷修复（对应 PATCH 版本） |
| `docs` | 仅文档变更 |
| `style` | 格式调整，不影响逻辑 |
| `refactor` | 重构，非修复也非新功能 |
| `perf` | 性能优化 |
| `test` | 添加或修复测试 |
| `build` | 构建系统或依赖变更 |
| `ci` | CI 配置变更 |
| `chore` | 其他杂项（工具等） |

## 破坏性变更

在类型/范围后加 `!`，或在页脚加 `BREAKING CHANGE:`：

```
feat!: 移除对 Node 6 的支持

feat(api)!: 重命名用户接口

fix: 修复解析问题

BREAKING CHANGE: 环境变量现在优先于配置文件
```

## 示例

```
feat: 添加用户登录页面
fix(auth): 修复 token 过期竞争问题
docs: 更新 API 鉴权文档
feat(lang): 添加波兰语支持
chore: 升级依赖版本
```

## 规则

- 描述：使用祈使句，小写开头，末尾不加句号
- 正文：描述后空一行，自由格式
- 页脚：正文后空一行，`token: 值` 格式
- `BREAKING CHANGE` 在页脚中必须全大写

<!--
来源: https://www.conventionalcommits.org/en/v1.0.0/
-->
