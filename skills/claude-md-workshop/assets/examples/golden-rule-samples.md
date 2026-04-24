# Golden Rule — 样本精选

> 兜底规则的写法变体。Golden Rule 是所有其他规则失效时的安全网。

## 推荐写法（workshop 默认）

```markdown
## Golden Rule

When unsure about requirements, implementation, or scope, ASK before changing code.
```

## 变体 1：业务导向（diwank / Julep）

<!-- 来自 diwank-field-notes.md 第 203-204 行的 CLAUDE.md 示例 -->

```markdown
## The Golden Rule
When unsure about implementation details, ALWAYS ask the developer.
```

同一篇文章配套 NEVER 清单，反复强调：
- "Never assume business logic — Always ask"
- "Claude is your intern with encyclopedic knowledge but zero context about your specific system, your users, your business logic."

关键词：`implementation details`、`developer`——强调业务判断属于人。

## 变体 2：协作强调（callmephilip）

<!-- callmephilip-best-practices.md 无显式 Golden Rule 段；提取其引用 Julep 与整篇主旨最接近兜底的两条原则 -->

```markdown
- If an AI tool touches a test file, the PR gets rejected. No exceptions.
- Front-load context to avoid iteration cycles. Being stingy with context to save tokens actually costs you more.
```

原文没有命名为 "Golden Rule" 的段；兜底精神藏在两条协作/流程硬规则里：测试归人、前期充分上下文。

## 何时选哪个变体

- **项目初期 / 规则少**：用推荐写法（简单覆盖面广）
- **和外部合作 / 业务复杂**：用变体 1（强调 ASK 而非 assume，业务词汇明确）
- **团队项目**：用变体 2（强调不可逾越的协作边界，例如测试所有权）

## 判断标准（写给审查模式）

- **有 Golden Rule**：✓
- **无 Golden Rule**：△ 警告，建议补一条
- **"Golden Rule" 但内容空泛**（如 `Be helpful` / `Write good code`）：✗ 不算
- **Golden Rule 触发条件明确**（"When unsure about X"）：✓ 加分
