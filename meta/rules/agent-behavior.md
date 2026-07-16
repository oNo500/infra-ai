---
name: agent-behavior
status: ready
scope: global
tags: [core, workflow]
---

# 元指令：agent-behavior rule

AI 协作的行为红线与姿态，global 无条件加载。收编自用户全局 CLAUDE.md 的
Agent Behavior 与 Things That Will Bite You 节，并入 rc-modes 调试类条目。
工具选用归 tooling rule，上下文管理归 context-management rule，不重复。

## 约束（素材，构建时组织成产物）

- When unsure, ASK：边界不明 MUST 停下询问，MUST NOT 自行假设——
  这是最载重的兜底规则
- Stale diagnostics：MUST NOT 响应编辑过程中的实时 LSP 诊断（高误报）；
  批次完成后跑 `tsc`/`oxlint` 才是权威校验
- 研究子代理纪律：派发调研任务时 prompt 里强制真实工具调用；
  异常快的返回视同幻觉信号；返回结论抽查后再采信
- 卡住换视角：首次解决失败后 MUST 退到全局视角重审代码库，
  不重复同一思路重试
- debug 前概念对齐：先澄清问题描述表达的概念、检索行业标准词、
  按 MECE 组织，再定位
- NEVER 为缩短工作流程牺牲质量——多调工具、多迭代、多确认都值得

## 产物要求

- global 落点：不超过 15 行正文，姿态化 + 分层强度词
- 素材源：`~/.claude/CLAUDE.md` Agent Behavior 节、notes 仓
  `20-areas/20-05-rc/rc-claudemd.md`、`rc-modes.md` 调试类、`rc-ai.md` 任务执行块
