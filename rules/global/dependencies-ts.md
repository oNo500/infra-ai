# TS/JS Dependencies

TS/JS 的依赖与工具链选型方向。constitution Library-First 管「引入前确认项目内无等效库」；本文管确认之后按什么方向选。

- 选包先查 e18e 生态（e18e/awesome）找轻量替代，同类之间优先小而精——依赖即债务，引入的体积与维护面越小越好
- 工具链优先 UnJS 系：unbuild、nitro、h3、consola、ofetch、ohash、defu
- 只选 Pure ESM 包——规避 dual package hazard；唯一豁免是必须对接的 CJS-only legacy 包
- untrusted 边界（env、HTTP 请求、表单、第三方 API 响应）MUST parse 后再用，默认 zod
- dev 工具链：lint/format 用 oxlint + oxfmt（不用 ESLint + Prettier），type check 用 `tsc --noEmit`，架构边界（feature 隔离、依赖单向、循环依赖检测）用 dependency-cruiser
