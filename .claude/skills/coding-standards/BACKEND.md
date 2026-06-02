# Backend Standards

## Database

**IDs** — always `integer().primaryKey({ autoIncrement: true })`. No UUIDs.

**Timestamps** — ISO strings in `text` columns, never unix/integers:
```ts
text("created_at").$defaultFn(() => new Date().toISOString())
```

**Booleans** — stored as integers with `mode: "boolean"`:
```ts
integer("ppp_enabled", { mode: "boolean" })
```

**Soft deletes** — nullable `text("deleted_at")` column, never hard-delete rows. See `lessonComments` in schema.

**Prices** — stored in cents (integers). Use `formatPrice()` from `~/lib/utils` to display (handles "Free" for 0/null).

**DB instance** — initialized in `app/db/index.ts` with WAL mode + foreign keys. Don't create new connections in service code.

---

## Routing (React Router v7)

Routes live in `app/routes/`. Each file can export: `loader`, `action`, `default` (component), `meta`, `ErrorBoundary`.

**No business logic in routes** — call into services instead.

**Auth** — cookie-based via `~/lib/session`:
```ts
const userId = await getCurrentUserId(request); // number | null
if (!userId) return redirect("/login");
```

**Validation** — use helpers from `~/lib/validation`:
```ts
const { success, data, errors } = parseFormData(formData, zodSchema);
// also: parseParams, parseJsonBody
```

**Multiple form submissions** on one route → Zod discriminated union on `intent`:
```ts
const schema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("mark-complete") }),
  z.object({ intent: z.literal("delete-comment"), commentId: z.coerce.number() }),
]);
```

---

## Services

Any file named `*Service.ts` must have a `*Service.test.ts` test file alongside it.
