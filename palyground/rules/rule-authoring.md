# AI 规则文件写作标准

本文件总结 `.claude/rules/` 类规则文件的写作标准。所有新规则文件 MUST 遵循。

本文件遵循 RFC 2119 关键词：MUST / MUST NOT / SHOULD / SHOULD NOT / MAY。

---

## 一、写作三层标准

每条规则 MUST 三层齐全：

### 1. 概念（What）

用专业术语命名，让 AI 关联训练数据。

- ✓ `Clean Architecture` / `DDD` / `Aggregate` / `Context Mapping` / `DIP`
- ✗ `按需分层` / `三种渠道` / `形态光谱` / `信号`

### 2. 原理（Why）

一句话判断依据，让 AI 能外推到边界场景。

- ✓ "类做 key 强制运行期 import 类，破坏类型隔离"
- ✓ "事务边界由装饰器元数据隐式声明，代码审查不可见"
- ✗ "因为这样更好" / "为了规范"

### 3. 动作（How）

可执行指令，无歧义、无模糊词。

- ✓ "MUST NOT 使用 `@Transactional()` 装饰器"
- ✓ "Controller MUST 返回 `XxxResponseDto` + 显式 `fromDomain()` 转换"
- ✗ "尽量..." / "考虑使用..." / "建议..."

三层关系：缺概念 → AI 调不到知识；缺原理 → 边界场景瞎编；缺动作 → 不知道做啥。

---

## 二、术语原则

本节遵循 ISO 704（术语工作的原则与方法）的核心精神：**单义性 / 首选术语 / 国际通用性**。

### 概念优先于词汇

写作 SHALL 反向流程：

- 明确要表达的**概念** → 检索行业标准词 → 直接采用
- MUST NOT 先想到一个词再凑概念
- 行业标准词缺失时 SHALL 停下检索（Wikipedia / Martin Fowler / Evans / RFC），MUST NOT 自造

### 优先行业标准词

- 专业术语优先（蓝皮书 / SOLID / RFC 等）：`Open Host Service` / `Published Language` / `DIP` / `MUST` / `SHALL`
- 中英对照只在术语**首次出现**做锚点：`演进式架构（Evolutionary Architecture）`
- 后续 MUST 统一用一种表达

### 同一概念只用一个词汇

- ✓ 全文 `context`（不混用"上下文" / "限界上下文" / "业务 context"）
- ✓ 全文 `domain event`（不混用"领域事件"）
- ✓ 全文 `aggregate`（不混用"聚合"中文）

### 禁止造词

不要发明业内不存在的复合词：

- ✗ `演化策略` `信号` `渠道` `形态光谱` `通信机制` `准入治理` `内部分层`
- ✓ `Evolutionary Architecture` `Tactical Layering` `Context Mapping`

### 定义规则

文档内的定义（术语表 / 章节解释）：

- MUST NOT 循环（用 A 定义 B 又用 B 定义 A）
- MUST NOT 用否定式（"X 不是 Y" 不是定义；定义须说明 X **是什么**）
- SHALL 用"种 + 属差"形式（例：`aggregate 是封装一致性约束的领域对象集合`）

### 用 RFC 2119 关键词

替换中文模糊动词：

| 中文 | RFC 2119 |
|---|---|
| 必须 / 一定 | MUST / SHALL |
| 禁止 / 不要 | MUST NOT / SHALL NOT |
| 建议 / 应该 | SHOULD |
| 不建议 | SHOULD NOT |
| 可以 / 允许 | MAY |

文件开头 SHALL 声明：

```
本文件遵循 RFC 2119 关键词：MUST / MUST NOT / SHOULD / SHOULD NOT / MAY。
```

---

## 三、结构原则

### 单 H1 + 扁平 ##

- 每个文件 MUST 仅一个 `#` 顶级标题
- 章节扁平化，最深 `###`，避免 `####`+
- 父壳章节（只一句话 + 子标题）合并到子内容

### 章节命名

- `## 目录约定`（代码规则）/ `## File Locations`（测试规则）
- `## Anti-patterns`（集中禁令，替代"禁止行为" / "Things That Will Bite You"）
- `## Human-in-the-loop`（决策升级，替代"停下问用户" / "升级决策"）
- 子章节 SHALL 使用名词性短语（`### Aggregate Invariants` 而非 `### 聚合规则`）

### 章节顺序模板

```
（前言：引用范围 + 架构基线 + RFC 2119 + <architecture_thought>）
## 目录约定
## 依赖方向（如适用）
## [核心概念章节...]
## Anti-patterns
## Human-in-the-loop
（结尾：lint 兜底说明）
```

### 删除冗余

- 同义复述（"必须零依赖" 已"禁"了）
- 隐含信息（"port 接口（Symbol + interface）" port 本身就是这个）
- 被表格 / 章节覆盖的重复说明
- 给人类的导览注释（"蓝皮书 Part II" / "下方" / "review 看不到范围"）

---

## 四、内容取舍

### MUST 写

- 项目特异性约束（团队选择、非默认行为）
- 落地技术细节（Symbol token / `import type` / 构造函数注入）
- 跳出常识的禁令（禁 `@Transactional()` / 禁双向事件）
- 触发"停下问用户"的边界场景

### MUST NOT 写

- 通用知识（DDD / Clean Architecture / KISS / DRY 训练数据已有）
- 代码示例样板（让 AI 用 grep 查项目真实代码）
- 教学性映射（"看到 X 写 Y" 的全列表）
- 项目历史 / 选型动机（架构师文档的事）
- ASCII 嵌套框图（AI 把它当文本扫，浪费 token；目录 tree 例外）

---

## 五、强制思维链

每个文件前言段 MUST 加：

```markdown
执行任何代码写入前，AI MUST 在 `<architecture_thought>` 标签内评估当前任务，确认遵循路径后再编码。评估 MUST 覆盖：[评估维度1]、[评估维度2]、[评估维度3]、是否触发 §Human-in-the-loop。
```

评估维度 MUST 引用本文件已有章节，零额外维护成本。

非架构域可换标签（如 PKM 用 `<knowledge_thought>`）。

---

## 六、架构基线声明

每个文件前言 SHALL 声明架构基线，格式：

```
**架构基线**：[方法论 1]（[作者]）+ [方法论 2] + [方法论 3]，落地于 [技术栈]。
```

例：

- `Clean Architecture（Robert C. Martin）+ DDD（Eric Evans 蓝皮书）的 Strategic / Tactical 模式，落地于 NestJS 11 + TypeScript`
- `Bulletproof React（生产级 features-first 架构）+ 借鉴 FSD 的业务能力切分理念，落地于 Next.js 16 App Router + TypeScript`
- `Test Pyramid（Mike Cohn）+ Hexagonal Testing，落地于 Vitest + Supertest`

作用：作者归属 + 方法论锚点，让 AI 立刻关联完整知识体系。

---

## 七、表格 vs 列表

- 二维数据（行列均有意义）SHALL 用表格
- 触发条件 / 引入约束这种 "X → Y" 映射 SHOULD 用列表
- 决策矩阵 MAY 用表格

---

## 八、维护原则

### 改规则前

- MUST 扫一遍真实代码（不要写虚构示例 / 虚构目录）
- 验证现有规则的实际遵守度
- 找漏掉的真实约束

### 改规则时

- 同一改动一次性过完，不要反复折腾
- 写完自查每个词是否行业术语（避免造词）
- 自查同一概念是否多词混用

### 与其他规则文件协调

- paths frontmatter 互不重叠（避免规则冲突）
- 跨文件相同概念用相同术语（如 `context` / `feature` 全项目统一）
- 全局规则（无 paths）MUST NOT 与路径规则冲突

---

## 九、文件分工模式

### 全局规则（无 frontmatter paths）

- `constitution.md` — Core Principles + Tooling + Workflow
- 不写领域特定内容（NestJS / DDD / React 等）

### 路径规则（有 frontmatter paths）

- `api.md` → `apps/api/**`
- `admin-shadcn.md` → `apps/admin-shadcn/**`
- `web.md` → `apps/web/**`
- 自包含，不引用其他规则文件

### 测试规则

- 独立文件 + 独立 paths（`*.spec.ts` / `*.test.tsx`）
- 与代码规则不冲突，立场对齐

---

## 十、Anti-patterns（写规则的反模式）

- MUST NOT 写章节命名带"哄稚童"语气（"Things That Will Bite You" / "停下问用户"）
- MUST NOT 用 ASCII 框图代替 mermaid 或目录 tree
- MUST NOT 在规则里塞 Few-Shot 代码示例
- MUST NOT 给同一概念取两个名字
- MUST NOT 造业内不存在的术语
- MUST NOT 写"通常" / "一般" / "默认" 等软描述
- MUST NOT 用人类导览句（"如下" / "见下方" / "蓝皮书 Part II"）
- MUST NOT 描述事实快照（"目录结构" 应改为"目录约定"）
- MUST NOT 重复 constitution 已有的通用原则
- MUST NOT 在规则里写"为什么这样选"（属于 ADR / docs/architecture）

---

## Human-in-the-loop

- 规则与代码冲突无法判定意图 — 停下读 git blame + ADR
- 新增章节命名找不到行业标准词 — 停下检索（Wikipedia / Martin Fowler / Evans）
- 项目特异性偏好与行业标准冲突 — 停下确认是项目立场还是误解
