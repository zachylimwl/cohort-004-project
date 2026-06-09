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

Work through the plan step by step.

### 4. Feedback loop

After implementing, run both checks and iterate until both pass:

```bash
pnpm typecheck   # must exit 0
pnpm run test    # must exit 0
```

### 5. Commit

Once both checks pass, commit the work.
