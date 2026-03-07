---
name: constitution-template
description: .claude/docs/constitution.md 的模板 - 核心原则与不可违反的规则
---

# Constitution 模板

用于生成 `.claude/docs/constitution.md`。

---

## 模板

```markdown
# [PROJECT_NAME] Constitution
<!-- 示例：Spec Constitution、TaskFlow Constitution 等 -->


## Core Principles

### [PRINCIPLE_1_NAME]
<!-- 示例：一、Library-First -->
[PRINCIPLE_1_DESCRIPTION]
<!-- 示例：每个功能从独立库开始构建；库必须自包含、可独立测试、有完整文档；需有明确用途，不允许仅作为组织用途的库 -->

### [PRINCIPLE_2_NAME]
<!-- 示例：二、CLI 接口 -->
[PRINCIPLE_2_DESCRIPTION]
<!-- 示例：每个库通过 CLI 对外暴露功能；文本输入/输出协议：stdin/args → stdout，错误 → stderr；支持 JSON 和人类可读格式 -->

### [PRINCIPLE_3_NAME]
<!-- 示例：三、Test-Driven Development（NON-NEGOTIABLE） -->
[PRINCIPLE_3_DESCRIPTION]
<!-- 示例：TDD 强制执行：先写测试 → 用户确认 → 测试失败 → 再实现；严格遵循 Red-Green-Refactor 循环 -->

### [PRINCIPLE_4_NAME]
<!-- 示例：四、Contract Tests -->
[PRINCIPLE_4_DESCRIPTION]
<!-- 示例：需要 Contract Tests 的重点领域：新库契约测试、契约变更、服务间通信、共享 Schema -->

### [PRINCIPLE_5_NAME]
<!-- 示例：五、可观测性；六、版本管理与破坏性变更；七、简洁性 -->
[PRINCIPLE_5_DESCRIPTION]
<!-- 示例：文本 I/O 确保可调试性；需要结构化日志；或：采用 MAJOR.MINOR.BUILD 格式；或：从简单开始，遵循 YAGNI 原则 -->

---

## [SECTION_2_NAME]
<!-- 示例：Development Constraints、安全要求、性能标准等 -->

[SECTION_2_CONTENT]
<!-- 示例：技术栈要求、合规标准、部署策略等 -->

## [SECTION_3_NAME]
<!-- 示例：Development Workflow、评审流程、质量门禁等 -->

[SECTION_3_CONTENT]
<!-- 示例：代码审查要求、测试门禁、部署审批流程等 -->


## Governance

[GOVERNANCE_RULES]
<!-- 示例：Constitution 优先于所有其他文档；修订需文档说明、审批及迁移计划 -->

[GOVERNANCE_RULES]
<!-- 示例：所有 PR/代码审查必须验证合规性；复杂度须有合理依据；运行时开发指引请参考 [GUIDANCE_FILE] -->

**Version**: [CONSTITUTION_VERSION] | **Ratified**: [RATIFICATION_DATE] | **Last Amended**: [LAST_AMENDED_DATE]
```

---

## AI 填写指南

### 占位符填充规则

- **从仓库上下文推断** — 优先从 README、现有 CLAUDE.md、配置文件中提取，再向用户提问
- **原则数量以实际为准** — 模板给出 3 个原则槽，实际可多可少；无需凑够固定数量
- **不留方括号 token** — 所有 `[ALL_CAPS]` 占位符必须替换为真实内容，若某章节确实不适用则整节删除
- **注释可删除** — `<!-- -->` 注释在替换后无需保留，除非仍有指导价值

### 原则写法

每条原则：
- **名称行简洁**，如"一、Library-First"、"Test-Driven Development（NON-NEGOTIABLE）"
- **内容声明性、可测试** — 避免模糊语言（"应该考虑" → "MUST"/"禁止"）
- **包含理由** — 说明这条规则防止了什么问题

格式与风格要求：

- 严格使用模板中的 Markdown 标题（不降级/升级）。
- 将长理由行折行以保持可读性（理想 <100 字符），但不要用奇怪的换行强制执行。
- 章节之间保留单个空行。
- 避免尾随空格。


### 版本与日期

- `RATIFICATION_DATE`：首次采用日期；若未知，标记 `TODO(RATIFICATION_DATE)`
- `LAST_AMENDED_DATE`：本次修改日期（ISO 格式 `YYYY-MM-DD`）
- `CONSTITUTION_VERSION` 语义递增：
  - MAJOR：删除或重新定义原则（向后不兼容）
  - MINOR：新增原则或章节
  - PATCH：措辞澄清、拼写修正

### Governance 章节

至少包含：
- Constitution 的优先级声明（优先于其他所有文档）
- 修订程序（谁可以修改、如何生效）
- 合规预期（代码审查中如何验证）
