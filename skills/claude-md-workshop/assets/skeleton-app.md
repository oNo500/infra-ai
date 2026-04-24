# Stage-1 骨架：应用 / 产品项目

> 模板。比 minimal 多一个「架构约束」段（一行）和扩充的保护区段。保持 < 30 行。

```markdown
# {{project_summary}}

## Golden Rule

{{golden_rule}}

## NEVER

{{never_list}}

## 快速命令

```bash
{{commands}}
```

## 架构约束（一行原则）

{{architecture_principle}}

## 保护区

{{protected_paths}}

## Things That Will Bite You

{{bite_you}}

## 再次强调

{{never_list_short}}
```

## 填空规则

- `{{architecture_principle}}` — 按推断的框架给一行默认：
  - Next.js App Router → `Server Components by default; Client Components only when interaction is required.`
  - NestJS → `Feature modules own their controllers, services, DTOs; no cross-feature imports.`
  - FastAPI → `Routers are thin; business logic in services/; validation via Pydantic.`
  - 不确定 → 默认 `Feature-based organization: each business capability owns its routes, services, tests.`
- 其他占位符见 `skeleton-minimal.md`

## 产出示例（Next.js 项目填空后）

```markdown
# acme-dashboard · Next.js 16 App Router · TypeScript · Prisma · Tailwind

## Golden Rule

When unsure about business logic or architectural decisions, ASK before implementing.

## NEVER

- NEVER modify `src/auth/**` without approval
- NEVER bypass Zod validation on API routes
- NEVER use `as any` in types

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
- `__tests__/**`

## Things That Will Bite You

- `dark:` variant in Tailwind cannot be dynamically concatenated — write full string

## 再次强调

- NEVER modify auth / migrations
- NEVER use `as any`
```
