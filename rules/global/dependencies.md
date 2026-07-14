# Dependencies

选型偏好。引入前先确认项目内无等效库（constitution Library-First）；本文管确认之后按什么方向选。

- 选包先查 e18e 生态（e18e/awesome）找轻量替代，同类之间优先小而精
- TS/JS 工具链优先 UnJS 系：unbuild、nitro、h3、consola、ofetch、ohash、defu
- 只用 Pure ESM 包，规避 dual package hazard；唯一豁免是必须对接的 CJS-only legacy 包
- untrusted 边界（env、HTTP 请求、表单、第三方 API 响应）一律 zod parse 后再用
- AI 应用生产落地默认 Vercel AI SDK（多 provider 切换、streaming UI）
