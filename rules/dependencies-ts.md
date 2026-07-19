# TS/JS Dependencies

- 选包先查 e18e 生态（e18e/awesome）找轻量替代，同类之间优先小而精——依赖即债务，引入的体积与维护面越小越好
- 工具链优先 UnJS 系：unbuild、nitro、h3、consola、ofetch、ohash、defu
- 只选 Pure ESM 包——规避 dual package hazard；唯一豁免是必须对接的 CJS-only legacy 包
- untrusted 边界（env、HTTP 请求、表单、第三方 API 响应）MUST parse 后再用，默认 zod
- dev 工具链：lint/format 用 oxlint + oxfmt，type check 用 `tsc --noEmit`，架构边界（feature 隔离、依赖单向、循环依赖检测）用 dependency-cruiser
- 包管理用 pnpm（硬链接、无幻影依赖、workspace 原生），corepack 锁定 `packageManager` 字段
- 依赖健康三件套：syncpack 查版本一致性、taze 更新、knip 查未使用依赖
- SemVer 范围：应用用 `^`、发布的库用 `~`、关键基础设施精确锁定
