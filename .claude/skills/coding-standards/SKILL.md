---
name: coding-standards
description: Project coding standards and conventions for this codebase. Use when reviewing code, implementing features, conducting code reviews, checking standards compliance, or when user references coding conventions or project rules.
---

# Coding Standards

## Universal

**TypeScript**
- No `any` — check Drizzle schema or use `typeof` inference
- Multi-same-type params → object param: `fn(opts: { userId: string; postId: string })` not `fn(userId: string, postId: string)`
- Use `~/*` import alias for `/app` — never relative imports like `../../lib/utils`

**Results pattern** — tagged discriminated unions from services:
```ts
{ ok: true, data: ... } | { ok: false, error: string }
```
See `couponService` for reference.

---

## Backend

See [BACKEND.md](BACKEND.md) for:
- Database schema conventions (IDs, timestamps, booleans, soft deletes)
- Routing and actions (loaders, validation, auth)
- Service layer rules

---

## Frontend

See [FRONTEND.md](FRONTEND.md) for:
- Component placement and shadcn usage
- Tailwind/styling utilities
- Price formatting

---

## Testing

See [TESTING.md](TESTING.md) for:
- Vitest setup and db mocking
- Service test requirements
