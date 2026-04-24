# 失败模式段 — 样本精选

> 给 Claude 的错误处理剧本。没有这段时 Claude 遇阻会 improvise。

## 推荐写法模板（二段式：触发条件 + 正确响应）

```markdown
## 失败模式

- Pre-commit hook fails: read the error, locate the tool, fix the root cause. Do NOT use `--no-verify`.
- Test fails: show the output to me. Do NOT modify the test to make it pass.
- Type error: fix the type. Do NOT use `as any`.
- 同一问题纠正 2 次未解决：stop, `/clear`, restart with more specific prompt.
```

## 样本 1：harperreed Mandatory Pre-Commit Failure Protocol

<!-- 来自 harperreed--dotfiles--CLAUDE.md 第 141-152 行 + 第 270-271 行 Failure Recovery -->

```markdown
1. Mandatory Pre-Commit Failure Protocol

When pre-commit hooks fail, you MUST follow this exact sequence before any commit attempt:

1. Read the complete error output aloud (explain what you're seeing)
2. Identify which tool failed (biome, ruff, tests, etc.) and why
3. Explain the fix you will apply and why it addresses the root cause
4. Apply the fix and re-run hooks
5. Only proceed with commit after all hooks pass

NEVER commit with failing hooks. NEVER use --no-verify. If you cannot fix the hooks, you
must ask the user for help rather than bypass them.

## Failure Recovery
If a fix doesn't work after two attempts, stop. Re-read the entire relevant section top-down.
Figure out where your mental model was wrong and say so. If Doctor Biz says "step back" or
"we're going in circles," drop everything. Rethink from scratch.
```

标准二段式：触发（hook 失败 / 两次未修好）→ 具体动作序列（不是空泛的 "fix it"）。

## 样本 2：Julep AGENTS.md

<!-- Julep 没有命名为 "Failure mode" 的段；最接近的是 "AI Assistant Workflow" 第 7 步 + "Common pitfalls" 段 -->

```markdown
## AI Assistant Workflow (excerpt)

7. **If Stuck, Re-plan**: If you get stuck or blocked, return to step 3 to re-evaluate and
   adjust your plan.
10. **Session Boundaries**: If the user's request isn't directly related to the current
    context and can be safely started in a fresh session, suggest starting from scratch
    to avoid context confusion.

## Common pitfalls (触发清单)

- Mixing pytest & ward syntax (ward uses `@test()` decorator, not pytest fixtures/classes).
- Forgetting to `source .venv/bin/activate`.
- Wrong current working directory (CWD) or `PYTHONPATH` for commands/tests.
- Large AI refactors in a single commit (makes `git bisect` difficult).
- Delegating test/spec writing entirely to AI (can lead to false confidence).
```

Julep 的失败模式是分布式的——触发条件在 "Common pitfalls"，响应在 "Workflow 第 7/10 步"。不如 harperreed 集中，但仍是二段式。

## 判断标准（写给审查模式）

- **有失败模式段**：✓
- **无**：△ 警告，建议补一条。没有这段 Claude 遇阻会 improvise
- **只有"fix it"类空泛指令**：✗ 要具体到"做 X，不做 Y"的二段式
- **触发条件和响应都具体**：✓ 加分（如 harperreed 的 5 步协议）

## 常见需要覆盖的失败类型

- Pre-commit / pre-push hook 失败
- 测试失败
- 类型错误
- 依赖安装失败
- 重复纠正未解决（两次 / N 次阈值 + 停下来重新规划）
