# Testing Standards

## Requirements

Every `*Service.ts` file must have a `*Service.test.ts` alongside it.

## Vitest Setup

Tests use vitest with globals. **The db mock MUST come before importing the service under test.**

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";

let testDb: ReturnType<typeof createTestDb>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

// import service AFTER the mock
import { myService } from "~/services/myService";

beforeEach(async () => {
  testDb = createTestDb();
  await seedBaseData(testDb);
});
```
