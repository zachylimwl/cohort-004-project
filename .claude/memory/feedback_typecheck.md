---
name: feedback-typecheck
description: Use pnpm typecheck instead of pnpm tsc --noEmit for type checking in this project
metadata:
  type: feedback
---

Use `pnpm typecheck` (not `pnpm tsc --noEmit`) to run TypeScript type checking in this project.

**Why:** The project has a custom `typecheck` script in package.json that runs `react-router typegen && tsc`, which is needed to generate route types before checking.

**How to apply:** Always run `pnpm typecheck` when verifying types in this project.
