---
paths:
  - "**/*.{test,spec}.ts"
  - "**/*.{test,spec}.tsx"
---

# Testing Rules

## 核心原则

- **MUST write tests before implementation (TDD)**：先写测试，让测试失败，再实现，让测试通过
- **测试文件与源文件并置**：`foo.ts` + `foo.test.ts` 放在同一目录
- **e2e 测试**放在 `__tests__/e2e/` 或 `e2e/`

## 测试命令

```bash
# 运行所有单元测试
[test command]

# 运行特定测试
[test filter command]

# e2e 测试
[e2e command]
```

## 测试组织规范

- 单个测试文件对应单个源文件
- `describe` 块描述模块/类名，`it`/`test` 描述具体行为
- 测试名称格式：`it("should [expected behavior] when [condition]")`
- Mock 只 mock 外部依赖（网络、数据库），不 mock 内部实现

## 禁止行为

- 禁止为通过测试而修改测试断言（除非需求变更）
- 禁止跳过失败的测试（`it.skip`、`xit`）而不修复
- 禁止测试文件中使用 `console.log` 调试输出
