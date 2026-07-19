# Testing

## 组织

- 单元/集成测试与源文件同目录并置，一个测试文件对应一个源文件，后缀用 `.test.` 或 `.spec.`
  - 正：`src/user/service.ts` + `src/user/service.test.ts`；反：集中放进 `tests/` 目录
- e2e 测试独立于并置体系：放应用根目录 `e2e/`，命名 `*.e2e-spec.ts`

## 命名

- `describe` 写被测模块/类名；用例名读作完整句子：`it("should [expected behavior] when [condition]")`
  - 正：`it("should throw NotFoundError when user does not exist")`；反：`it("test getUser error")`

## Mock 边界

- 只 mock 外部依赖（网络、数据库），不 mock 内部实现——测的是行为而非实现，mock 内部会让重构破坏本应通过的测试
  - 正：mock HTTP client、repository 等外部调用；反：mock 同包内的工具函数或私有方法

## 纪律红线

- MUST NOT 为通过测试而修改断言（需求变更导致的断言更新除外）
- MUST NOT 用 `it.skip` / `xit` 跳过失败测试代替修复
- MUST NOT 在测试文件里留 `console.log` 调试输出
