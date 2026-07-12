# rule 构建

你在为本仓构建一条 rule 产物：输入是任务指令给出的元指令文件，输出是一个
markdown 文件。读完本文件与元指令后再动笔。

## 步骤

1. 读元指令，理解意图、约束与素材
2. 过下方检查清单，确认该不该独立成文、要不要 `paths`
3. 按元指令的 `scope` 决定落点与 frontmatter：
   - `scope: global` — 产物落 `rules/global/<name>.md`，不写 `paths`
   - `scope: "<glob>"` — 产物落 `rules/scoped/<name>.md`，glob 写进产物的
     `paths` frontmatter
4. 写产物。只写产物这一个文件，不修改其他文件，不提交

## 检查清单

### 该不该拆成独立文件

- CLAUDE.md（或本仓库的 `.claude/rules/` 汇总）临近或超过约 200 行时，
  开始往 `.claude/rules/*.md` 拆（Claude Code 官方建议阈值）
- 单个规则文件本身超过约 500 行，或职责已经不单一，再拆成多个可组合的小文件
  （Cursor 官方建议阈值，同样适用于此处）

### 要不要加 `paths` frontmatter

```yaml
---
paths:
  - "[glob-pattern]/**"
---
```

- 只在**这份规则脱离特定目录/文件类型就没有意义**时才加 `paths`
  （例如前端专属规则、测试专属规则）
- 否则整段 frontmatter 省略——省略时规则在每个 session 启动时自动加载，
  等同 CLAUDE.md 的效果
- 子目录会被自动发现（如 `.claude/rules/frontend/react.md`），不需要手动注册

### 写之前

- 内容能否从代码本身推断？能推断的不要写（Claude Code 官方建议：只写
  "Claude 无法从代码推断"的内容）
- 是不是在跟另一份规则文件表达相互矛盾的立场？矛盾规则同时出现在上下文里
  会互相抵消效果，先去重
- 是不是在描述"必须发生"的确定性行为（如自动格式化）？那种应该用 hook 实现，
  不是写进规则文件里指望 Claude 记得执行

## 写法要求

- `global/` 产物无条件进上下文：必须精简、姿态化，每主题一文件，
  每个字都占上下文预算
- `scoped/` 产物按 glob 触发加载：允许更细更长
- 正文以中文为主；术语、命令、代码与标识保留英文
