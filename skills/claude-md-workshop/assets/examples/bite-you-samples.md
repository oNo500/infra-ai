# Things That Will Bite You — 样本精选

> 从 `sources/samples/` 精选的高信号陷阱段样例。审查时用于对照密度；咨询/生成时作为写法参考。

## 什么是好陷阱

- 只有读过源码才知道
- 不是通用 best practice（Claude 能自己推断的不算）
- 一行一个具体事实，不讲理由
- ≤ 8 条一组（更多就会稀释）

## 样本 1：anthropics/claude-code-action

```markdown
## Things That Will Bite You

- **Strict TypeScript**: `noUnusedLocals` and `noUnusedParameters` are enabled. Typecheck will fail on unused variables.
- **Discriminated unions for GitHub context**: `GitHubContext` is a union type — call `isEntityContext(context)` before accessing entity-specific fields like `context.issue` or `context.pullRequest`.
- **Token lifecycle matters**: The GitHub App token is obtained early and revoked in a separate `always()` step in `action.yml`. If you move token revocation into `run.ts`, it won't run if the process crashes. Same for SSH signing cleanup.
- **Error phase attribution**: The catch block in `run.ts` uses `prepareCompleted` to distinguish prepare failures from execution failures.
- **`action.yml` outputs reference step IDs**: Outputs like `execution_file`, `branch_name`, `github_token` reference `steps.run.outputs.*`. If you rename the step ID, update the outputs section too.
- **Integration testing** happens in a separate repo (`install-test`), not here. The tests in this repo are unit tests.
```

**密度**：6 条，每条一个具体反直觉事实（token 生命周期、union 分辨、输出跨引用等）。

## 样本 2：humanlayer/humanlayer

<!-- 源文件无显式 bite-you 段；提取 TODO 优先级枚举——这是项目特有约定，Claude 无法从代码推断出 -->

```markdown
### TODO Annotations

We use a priority-based TODO annotation system throughout the codebase:

- `TODO(0)`: Critical - never merge
- `TODO(1)`: High - architectural flaws, major bugs
- `TODO(2)`: Medium - minor bugs, missing features
- `TODO(3)`: Low - polish, tests, documentation
- `TODO(4)`: Questions/investigations needed
- `PERF`: Performance optimization opportunities
```

**密度**：6 条枚举；虽非典型"陷阱"，但属于「读了源码才知道」的本地约定，是 bite-you 的合法变体。

## 样本 3：julep-ai/julep

```markdown
## 11. Common pitfalls

- Mixing pytest & ward syntax (ward uses `@test()` decorator, not pytest fixtures/classes).
- Forgetting to `source .venv/bin/activate`.
- Wrong current working directory (CWD) or `PYTHONPATH` for commands/tests (e.g., ensure you are in `agents-api/` not root for some `agents-api` tasks).
- Large AI refactors in a single commit (makes `git bisect` difficult).
- Delegating test/spec writing entirely to AI (can lead to false confidence).
- **Note about `src/`**: Only the `cli` component has a `src/` directory. For `src/agents-api`, code is directly in `agents_api/`. Follow the existing pattern for each component.
```

**密度**：6 条，混合语法/环境/工作流陷阱——典型的 bite-you 风格。

## 判断标准（写给审查模式）

用户的 Things That Will Bite You 段，和这些样本对比：

- **密度通过**：4-8 条，每条一个具体事实
- **密度警告**：少于 3 条（信号不足）或超过 10 条（稀释）
- **内容通过**：每条都是项目特有的、读源码才知道的反直觉事实
- **内容警告**：能在 README / 框架文档里找到的通用警告 → 不算 bite-you
