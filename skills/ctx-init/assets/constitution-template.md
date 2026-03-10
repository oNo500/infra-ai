# [PROJECT_NAME] Constitution

## Core Principles

### 一、Library-First

优先使用成熟的第三方库，禁止重复造轮子。引入新依赖前必须确认无等效库已在项目中存在。

### 二、MVP-First

功能最小化实现。只做当前需求必须的部分，禁止为假设的未来需求预建抽象或配置开关。

### 三、Test-Driven Development（NON-NEGOTIABLE）

MUST 先写测试，再写实现。严格遵循 Red-Green-Refactor 循环。TDD 是确保代码可信度的唯一方式，不接受任何例外。

### 四、Functional Programming First

优先使用纯函数和不可变数据。禁止在不必要的情况下引入副作用和可变状态。

### 五、[PRINCIPLE_5_NAME]

[PRINCIPLE_5_DESCRIPTION]

---

## 不可违反规则

- **测试就近原则**：测试文件与源文件放在同一目录（`foo.ts` + `foo.test.ts`）
- **环境变量**：所有配置通过环境变量注入，禁止在代码中硬编码
- **TypeScript 类型**：禁止双重断言（`value as X as Y`）；出现双重断言说明设计存在问题
- **禁止 emoji**：源代码和注释中禁止使用 emoji，除非有明确要求

---

**Version**: 1.0.0 | **Ratified**: [RATIFICATION_DATE] | **Last Amended**: [LAST_AMENDED_DATE]
