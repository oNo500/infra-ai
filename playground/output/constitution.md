# Constitution

跨项目根级约束。文档分三层:

- **先验姿态**(Library-first / MVP-first / Test-driven / Functional-first / Feature-based / Self-documenting):常驻立场,影响所有决策,不带触发条件
- **工作流**:条件命中时强制执行,违反导致 bug 或不可恢复后果
- **工具偏好**:弱约束,违反不致命但需要理由

下方代码块为可复制规则,整块 copy 到目标项目的 `AGENTS.md` / `CLAUDE.md` / `.claude/rules/constitution.md` 即可。

---

```markdown

## Library-first

引入新依赖前先确认无等效库已存在。重复造轮子在长程维护中拖累一致性与升级路径。
TypeScript 项目优先看 unjs 生态(h3 / nitro / unstorage / ofetch / consola / pathe / defu / scule / std-env / unbuild)——它们共享 ESM、跨 runtime、零依赖基线。

## MVP-first

只实现当前需求。不为假设的未来需求预建抽象、配置开关、扩展点。
"可能用得上"是删除信号,不是保留理由。

## Test-driven

写实现前先写一个会失败的测试,看到它失败,再写最小实现让它通过,然后重构。
节奏发生在编辑器里,工具无法验证——靠自觉。

## Functional-first

优先用纯函数和不可变数据。把副作用(I/O、随机、时间、全局状态)推到边界,让核心逻辑可独立推理与测试。

## Feature-based

按业务能力组织代码,不按技术分层。具体目录约定由各项目规则定义。

## Self-documenting

命名自表达,代码自身就是文档。

- 注释只解释 *why*(取舍、约束、踩过的坑),MUST NOT 复述 *what*
- 想加注释解释一段代码做什么时,先尝试改名/拆函数让代码自表达;改不了再写注释
- 触发改名的信号:函数名是动词模糊词(`process` / `handle` / `do`),变量名是类型词(`data` / `info` / `result`),布尔变量没有 `is/has/should` 前缀

## 工作流

- **When unsure, ASK**:需求、实现、范围有 ≥2 种合理解读时,MUST 停下询问,MUST NOT 自行假设。
- **Git Flow**:编码前 MUST 调用 `gitflow-commit` skill 决定分支策略。
- **签名变更**:修改公开函数/类型签名前 MUST 先 `findReferences`。Why: 编译器对动态导入、JSX、字符串引用的覆盖不完整,直接改会留下隐式断点。
- **Commit 语言**:commit message MUST 用英文,遵循 Conventional Commits。

## 工具偏好

- **Code Navigation**:LSP(`goToDefinition` / `findReferences`)优先于文本搜索。LSP 基于语义,文本搜索会漏重命名导出、类型别名、JSX 属性。
- **Text Search**:`rg` / `fd` 限于字符串、注释、配置场景。
- **Information Retrieval**:`context7`(API 文档) → `gh code search`(用法) → `Exa`(趋势 / 对比) → `Brave Search`(兜底)。
- **GitHub CLI**:用 `gh` 而非 `curl`。`gh` 自动处理认证、分页、JSON schema;`curl` 需手动拼 token,易暴露凭证到 shell history。

## Things That Will Bite You

- **Stale LSP Diagnostics**:编辑过程中的实时 LSP 诊断高误报。MUST NOT 据此回改;批次完成后 MUST 跑 `tsc` / `oxlint` 作为权威校验。
```
