# 产物 web 预览 — Design

给「认真审阅构建产物」提供本地 web 预览：左侧资产列表、主区元指令与产物
左右对照。审阅走 web（排版上限决定审阅体验上限），TUI 保持状态机操作台的
窄职责，不做终端分屏阅读器。

## Problem

产物本质是文档（rule/skill 正文），审阅要逐条读、要与元指令对照。终端渲染
markdown 上限低（等宽、CJK 折行、无层级）；手工发 Artifact 要经外网且是
静态快照。需要本地、确定性、请求即最新的预览能力。

## Decisions

1. **形态**——`packages/preview`，从 `starters/web` 起底
   （`bunx giget@latest gh:oNo500/infra-code/starters/web#master`）：
   Bun.serve 单进程（页面 + API 同端口）、React 19、Tailwind v4；
   加装 shadcn/ui（init + `badge`/`tabs`/`scroll-area`/`separator` 四件起步，
   组件源码落 `src/components/ui/`，kebab-case）。

2. **数据零重复**——`@infra-ai/meta-cli` 新增 core barrel
   （`src/core/index.ts` + package.json `exports."./core"`）；preview 的
   `server.ts` 直接 import `loadOverview`/`discoverAssets` 等，
   发现与状态逻辑单源。两个 API 路由：
   - `GET /api/assets` — 资产清单（name/kind/status）
   - `GET /api/asset/:name` — 元指令与产物原文 + 路径
   每次请求现读文件——浏览器刷新即最新，不做 watch/websocket。

3. **UI**——左侧资产列表（状态 badge 用 TUI 同款语义色），主区
   元指令 | 产物双栏（markdown 渲染用 `marked`；窄屏收成 tabs 切换）；
   URL hash 携带选中资产（`/#typescript`），刷新/直链可用。

4. **入口经注册表**（parity 红线）——新增 `preview` 动作（mutation）：
   - `imeta preview [name]`：探测 server（`GET /api/assets`）——不可达则
     detached 启动（`io` 增 `spawnDetached`，日志落 `.imeta/preview-server.log`）
     并轮询就绪；随后 `open http://localhost:4412/#<name>`
   - 再次调用只 open；TUI 资产视图绑 `v` 键，调同一动作
   - 停止：不提供子命令，手动 kill（文档注明）；spawn/就绪超时报错不静默

5. **端口固定 4412**——被其它进程占用且 `/api/assets` 探测不像本服务时报错。

## Testing

- preview 包：API 路由处理拆纯函数单测（temp 仓库 fixture）；
  组件冒烟沿用 starter 的 bun test + testing-library
- meta-cli：`preview` 动作单测（注入 fetchJson/spawnDetached/open 经 ctx.run
  的 fake：已运行→只 open；未运行→spawn+轮询+open；超时→fail）
- parity 测试自动覆盖新动作（keymap `v` + CLI 子命令）

## Error Handling

- server 启动失败/就绪超时：动作 fail，消息附 `.imeta/preview-server.log` 路径
- API 对未知资产返回 404，页面显示错误态

## Non-Goals

- websocket 实时推送（刷新即最新已够）
- 编辑能力（预览只读；改动仍走元指令/writeback）
- 鉴权与远程访问（仅本机）
- 生产 build/部署流程（dev server 形态即终态）
