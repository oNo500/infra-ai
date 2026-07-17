---
name: claude-md
status: ready
---

# claude-md

项目入口 `CLAUDE.md` 的模板。产物保留 `[ALL_CAPS]` 占位符，分发时结合
目标项目实例化，落目标项目根 `CLAUDE.md`。素材：git 历史
claude-md-workshop 的 Stage-1 骨架（minimal/app 变体合并）+ notes 仓
rc-claudemd 模板结构。

## 定位

- 入口保持 <50 行：架构约定、编码规范、测试纪律已由 `.claude/rules/`
  （profile 拼装）承载，入口只做「项目一句话 + 红线 + 命令 + 指路」
- 首尾强调技巧：最易被违反的 NEVER 条目在结尾「再次强调」节重复
  2-3 条——长上下文里首尾位置的指令存活率最高

## 骨架章节（按序）

1. H1：`[PROJECT_NAME] · [FRAMEWORK] · [LANGUAGE] · [RUNTIME]`
   一行项目概括
2. Golden Rule：默认
   `When unsure about requirements, implementation, or scope, ASK before changing code.`
3. NEVER 清单：`[NEVER_LIST]`——每条独立 `- NEVER ...` 行；
   项目没给就只放 `- NEVER push to main directly`
4. 快速命令：`[COMMANDS]`——从 package.json scripts 抽 3-5 条
   （dev/test/build/lint/typecheck）
5. 架构约束（一行）：`[ARCHITECTURE_PRINCIPLE]`——按框架给默认：
   Next.js App Router → Server Components by default；NestJS →
   feature modules 不跨模块 import；不确定 → feature-based organization
6. 保护区：`[PROTECTED_PATHS]`——不经批准不得改动的路径清单；
   没有就整节删
7. Things That Will Bite You：`[BITE_YOU]`——项目踩坑纪录；没有就整节删
8. 再次强调：`[NEVER_REPEAT]`——从 NEVER 清单挑最易违反的 2-3 条

## 产物要求

- 产物是「骨架 + 填空规则 + 一个填空后示例」三段式（参照
  templates/architecture.md 的形态），骨架里占位符用 `[ALL_CAPS]`
- 填空规则里写明：不适用的章节整节删除、入口总行数 <50、
  与 `.claude/rules/` 的分工一句话说清
