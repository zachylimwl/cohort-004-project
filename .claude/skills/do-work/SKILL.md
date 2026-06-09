---
name: do-work
description: Executes a unit of work in this repository end-to-end: plan, implement, validate with type checking and tests, then commit. Use when the user asks you to implement a feature, fix a bug, or complete any scoped coding task in this repo.
---

# Do Work

## Workflow

### 1. Understand

Before planning, build context:

- Read any plans, PRDs, or documents referenced in the task
- Explore the codebase to locate relevant files, patterns, and conventions (use `find` or `grep` rather than guessing)
- If the task is ambiguous — unclear scope, missing requirements, or multiple valid interpretations — ask the user to clarify before proceeding

### 2. Plan (Optional)

If the task has not already been planned, create a plan for it.

### 3. Implement

**For frontend code**: implement directly without TDD.

**For backend code**: use a tracer-bullet red/green cycle — one test at a time, refactor once at the end:

1. **Red** — write a single failing test that covers the next piece of behaviour. Run it and confirm it fails for the right reason.
2. **Green** — write the minimum production code to make that one test pass. Run the test again and confirm it is green.
3. Repeat from step 1 for the next behaviour until the slice is complete.
4. **Refactor** — once all tests are green, clean up the full implementation. Re-run all tests to confirm nothing regressed.

each test should target one thin vertical slice through the system. Never write the next test until the current one is green.

### 4. Feedback loop

After all tests are written and green, run both checks and iterate until both pass:

```bash
pnpm typecheck   # must exit 0
pnpm run test    # must exit 0
```

### 5. Commit

Once both checks pass, commit the work.
