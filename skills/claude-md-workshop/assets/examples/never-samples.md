# NEVER 清单 — 样本精选

> 来源：`sources/samples/trailofbits--claude-code-config--CLAUDE.md` + `sources/samples/harperreed--dotfiles--CLAUDE.md` + `sources/articles/docat-5-patterns.md`。审查/咨询时用于判断用户的 NEVER 数量和质量。

## 什么是好 NEVER

- ≤ 5 条（硬上限）
- 每条是「可验证的失败」—— 能通过 diff / lint / test / grep 判断违反了
- 安全红线 / 生产事故 / 不可逆操作
- 不是风格偏好（`NEVER use semicolons` 不是 NEVER，是 lint rule）

## 样本 1：trailofbits/claude-code-config

<!-- 来自 "Commits" 小节 + "CLI tools" 表中 trash 条目 -->

```markdown
- Never amend/rebase commits already pushed to shared branches
- Never push directly to main — use feature branches and PRs
- Never commit secrets, API keys, or credentials — use `.env` files (gitignored) and environment variables
- Never use `rm -rf` (use `trash` instead — moves to macOS Trash, recoverable)
- Never leave warnings unaddressed; a clean output is the baseline
```

5 条，都是可通过 grep/CI/工具验证的硬底线。

## 样本 2：harperreed/dotfiles

<!-- 来自 "Thoughts on git" 的 Pre-Commit Failure Protocol + Explicit Git Flag Prohibition -->

```markdown
- NEVER USE --no-verify WHEN COMMITTING CODE
- NEVER commit with failing hooks
- FORBIDDEN GIT FLAGS: --no-verify, --no-hooks, --no-pre-commit-hook
- NEVER implement a mock mode for testing or for any purpose. We always use real data and real APIs
- NEVER throw away the old implementation and rewrite without explicit permission
```

5 条，围绕 git hooks 绕过与重写失控——都能在 diff/命令历史里验证。

## 样本 3：docat 5 patterns（归纳）

<!-- 文章主张「把 negative 改成 positive」，本身没有 NEVER 清单。这里反向归纳：文章说不要做的 5 个写法反模式 -->

```markdown
- NEVER write 200-line CLAUDE.md — Claude 的 instruction budget 只有 100-150 条
- NEVER use negation ("Do NOT X") when positive equivalent exists — 模型处理否定成本更高
- NEVER rely on CLAUDE.md for hard requirements — 用 hooks 强制执行
- NEVER put domain-specific rules in root CLAUDE.md — 用子目录 CLAUDE.md 作用域
- NEVER add more rules to fix a violated rule — 问题是规则被稀释了，不是不够多
```

5 条，每条对应文章一个 pattern，属于「写 CLAUDE.md 时」的元规则。

## 判断标准（写给审查模式）

- **数量通过**：1-5 条
- **数量警告**：0 条（无硬底线）或 > 5 条（稀释权重）
- **内容通过**：每条能被工具/grep/审计验证违反了
- **内容警告**：模糊禁令（`NEVER write bad code`）或风格禁令（`NEVER use default exports`，应该降级到 rules 建议而非 NEVER）
