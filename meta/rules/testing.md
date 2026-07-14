---
name: testing
status: ready
scope: "**/*.{test,spec,e2e-spec}.{ts,tsx,js,jsx}"
---

# 元指令：testing rule

测试的组织、命名、mock 边界与纪律红线，作用于测试文件。

## 目标

TDD 姿态已在用户全局 constitution（Test-driven），本 rule 不重复；
只覆盖写测试时 Claude 无法从代码推断的组织约定与纪律。

## 约束（素材，构建时组织成产物）

- 并置：单元/集成测试与源文件同目录（`foo.ts` + `foo.test.ts`），
  一个测试文件对应一个源文件；后缀认 `.test.` / `.spec.`
- e2e 独立：放应用根目录 `e2e/`，命名 `*.e2e-spec.ts`
- 命名：`describe` 写模块/类名；用例读作
  `it("should [expected behavior] when [condition]")`
- mock 边界：只 mock 外部依赖（网络、数据库），不 mock 内部实现——
  测的是行为不是实现，mock 内部会让重构破坏测试
- 纪律红线（MUST NOT）：为通过测试修改断言（需求变更除外）；
  用 `it.skip`/`xit` 跳过失败测试而不修复；测试文件里留 `console.log` 调试输出

## 产物要求

- scoped 落点，每条给必要的正/反例（一行级）
- 素材源：notes 仓 `10-projects/10-07-infra-ai/rules/testing.md`、
  `20-areas/20-05-rc/rc-rules.md`
