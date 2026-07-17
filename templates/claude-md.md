# CLAUDE.md 模板

项目入口 `CLAUDE.md` 的模板。分发时结合目标项目实例化，落目标项目根
`CLAUDE.md`。入口与 `.claude/rules/` 的分工：架构约定、编码规范、测试纪律
由 rules（profile 拼装）承载，入口只做「项目一句话 + 红线 + 命令 + 指路」。

## 骨架

````markdown
# [PROJECT_NAME] · [FRAMEWORK] · [LANGUAGE] · [RUNTIME]

## Golden Rule

When unsure about requirements, implementation, or scope, ASK before changing code.

## NEVER

[NEVER_LIST]

## 快速命令

```bash
[COMMANDS]
```

## 架构约束

[ARCHITECTURE_PRINCIPLE]

## 保护区

[PROTECTED_PATHS]

## Things That Will Bite You

[BITE_YOU]

## 再次强调

[NEVER_REPEAT]
````

## 填空规则

- 实例化后总行数 <50；不适用的章节整节删除，不留空标题
- H1 即一行项目概括，例：`acme-dashboard · Next.js App Router · TypeScript · Node 22`；
  无框架的项目省略对应段
- Golden Rule 是所有项目共用的默认文案，直接保留；项目有更具体的判断边界时才替换
- `[NEVER_LIST]` — 每条独立 `- NEVER ...` 行；项目没给就只放
  `- NEVER push to main directly`
- `[COMMANDS]` — 从 package.json scripts 抽 3-5 条（dev/test/build/lint/typecheck）
- `[ARCHITECTURE_PRINCIPLE]` — 一行；按框架给默认：
  - Next.js App Router → `Server Components by default; Client Components only when interaction is required.`
  - NestJS → `Feature modules own their controllers, services, DTOs; no cross-feature imports.`
  - 不确定 → `Feature-based organization: each business capability owns its routes, services, tests.`
- `[PROTECTED_PATHS]` — 不经批准不得改动的路径，每条独立列表项；没有就整节删
- `[BITE_YOU]` — 项目踩坑纪录；没有就整节删
- `[NEVER_REPEAT]` — 从 NEVER 清单挑最易违反的 2-3 条在结尾重复：
  长上下文里首尾位置的指令存活率最高，结尾重复保住最关键红线

## 填空后示例

````markdown
# acme-dashboard · Next.js App Router · TypeScript · Node 22

## Golden Rule

When unsure about requirements, implementation, or scope, ASK before changing code.

## NEVER

- NEVER modify `prisma/migrations/**` by hand
- NEVER bypass Zod validation on API routes
- NEVER push to main directly

## 快速命令

```bash
pnpm dev
pnpm test
pnpm typecheck
pnpm lint
```

## 架构约束

Server Components by default; Client Components only when interaction is required.

## 保护区

- `src/auth/**`
- `prisma/migrations/**`

## Things That Will Bite You

- Tailwind `dark:` variant cannot be dynamically concatenated — write the full class string

## 再次强调

- NEVER modify migrations by hand
- NEVER bypass Zod validation on API routes
````
