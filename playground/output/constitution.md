# Constitution

## Core Principles

### Library-first
DRY 原则；避免 NIH 反模式。优先复用成熟开源实现。**TypeScript 项目 SHOULD 优先选 unjs 生态**（h3 / nitro / unstorage / ofetch / consola / pathe / defu / scule / std-env / unbuild 等）。

### MVP-first
YAGNI 原则。仅实现当前需求，MUST NOT 为推测性需求预留抽象。

### Test-driven
TDD（Kent Beck）。遵循 Red-Green-Refactor 循环；测试先于实现。

### Functional-first
FP 范式。纯函数 + 不可变数据；副作用 SHALL 隔离至边界（参考 Hexagonal / Functional Core, Imperative Shell）。

### Feature-based
Vertical Slicing。按业务能力组织，非技术分层。具体目录约定由各项目规则定义。

### Self-documenting
Clean Code（Robert C. Martin）。代码 SHOULD 通过语义化命名自表达；注释解释 *why* 而非 *what*；注释密度过高指示设计异味，触发重构信号。

## Tooling

- **Code Navigation**：LSP（`goToDefinition` / `findReferences`）SHALL 优先于文本搜索
- **Text Search**：`rg` / `fd` 仅用于字符串、注释、配置
- **Refactoring**：变更签名前 MUST 先 `findReferences`
- **Information Retrieval**：`context7`（API 文档） → `gh code search`（用法） → `Exa`（趋势 / 对比） → `Brave Search`（兜底）
- **CLI**：`gh` 替代 `curl`；`sg` 做 AST 操作；假定 shell 为 `zsh`

## Workflow

- **Git Flow**：编码前 MUST 调用 `gitflow-commit` skill 决定分支策略
- **Language**：注释 / commit message / 文档 SHALL 默认使用英文
- **When unsure, ASK**：边界不明 MUST 停下询问，MUST NOT 自行假设
- **Stale Diagnostics**：MUST NOT 响应编辑过程中的实时 LSP 诊断（高误报率）；批次完成后 MUST 运行 `tsc` / `oxlint` 作为权威校验
