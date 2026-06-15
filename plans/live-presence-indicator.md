# Research: Live Presence Indicator

## Goal

Show students who else is viewing the same lesson right now — displayed as a stack of avatars and names. Presence is true real-time (connected right now), not a "recently visited" heuristic.

---

## Approaches considered

### Polling (rejected)

Periodic `GET /api/lessons/:id/viewers` hitting SQLite every N seconds. Simple to implement but:

- Adds write load for heartbeats to SQLite (a single-writer database).
- Latency is bounded by poll interval, not actual connection state.
- Requires a DB table for ephemeral data that is useless after the session ends.

### SSE + in-memory store (rejected)

Server pushes presence state over a Server-Sent Events stream; the server holds a Map of connected clients per lesson. Works well for a single Node process, but:

- Presence state is lost on server restart.
- Does not scale past one server instance without a shared pub/sub bus (Redis, etc.).
- One-directional only; clients cannot signal presence back without a separate HTTP request.

### WebSockets (self-hosted, rejected)

Bidirectional, lowest latency. Requires standing up WebSocket infrastructure (e.g., `ws` or `socket.io`), sticky sessions or a shared message broker for multi-instance deployments. Operational burden outweighs the benefit for this feature.

### Ably Pub/Sub — Presence API (chosen)

Managed real-time infrastructure. Ably handles connection lifecycle, reconnection, fan-out, and presence semantics. The app only adds:

1. A server endpoint that mints short-lived tokens.
2. A client-side React integration using Ably's official hooks.

---

## Why Ably over Pusher / PartyKit

|                                 | Ably                        | Pusher                         | PartyKit                          |
| ------------------------------- | --------------------------- | ------------------------------ | --------------------------------- |
| Free tier                       | 6M msgs/mo, 200 connections | 200K msgs/day, 200 connections | Cloudflare-based, edge-only       |
| Presence API                    | First-class, built-in       | Available on paid plans        | Room-based, requires worker logic |
| Global distribution             | Yes (own network)           | Limited                        | Cloudflare edge                   |
| Product direction               | Actively developed          | Stagnating per reviews         | Newer, smaller ecosystem          |
| Fit for React Router v7 on Node | Good                        | Good                           | Requires Cloudflare Workers       |

PartyKit is the wrong fit — it assumes Cloudflare Durable Objects and doesn't integrate naturally with a standard Node.js server. Pusher's free tier is too restrictive at 200K messages/day and its product direction is weaker. Ably wins on free tier headroom, native presence, and ecosystem maturity.

---

## How Ably Presence works

Every Ably channel has an associated **presence set** — a live list of clients that have called `presence.enter()`. Ably handles:

- **Enter**: client joins the set and broadcasts to all subscribers.
- **Leave**: triggers automatically when the client disconnects or navigates away — no explicit cleanup code required in most cases.
- **Update**: client can push new payload data while staying present.
- **Reconnect grace**: if a client briefly drops (e.g., network hiccup), Ably preserves presence membership for up to 15 seconds before broadcasting a leave. This prevents flicker.

Each presence member has:

- `clientId` — set by the server token (we use the user's DB integer ID as a string).
- `data` — arbitrary JSON payload (we attach `{ name, avatarUrl }`).

---

## Architecture

```
Browser (React)                    React Router v7 Server              Ably
─────────────────                  ───────────────────                 ────
AblyProvider (authUrl →)  ──GET──▶  /api/ably/token (loader)
                          ◀── token request ──  createTokenRequest()
                          ── connects to Ably ──────────────────────▶ WS open
ChannelProvider("lesson:{lessonId}")
usePresence(channel, { name, avatarUrl }) ──────────────────────────▶ presence.enter()
usePresenceListener(channel) ◀────────── presence events ───────────  fan-out
AvatarStack renders presenceData[]
```

**No database changes needed.** Presence is ephemeral and fully managed by Ably.

---

## Server: token endpoint

A React Router resource route at `/api/ably/token` (no default export — loader only):

```ts
// app/routes/api.ably.token.ts
export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request); // existing auth helper
  if (!session.userId) throw new Response("Unauthorized", { status: 401 });

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  });

  const ably = new Ably.Rest(process.env.ABLY_API_KEY!);
  const tokenRequest = await ably.auth.createTokenRequest({
    clientId: String(user.id),
    capability: { "lesson:*": ["presence", "subscribe"] },
    ttl: 3600 * 1000, // 1 hour; Ably client auto-renews
  });

  return Response.json(tokenRequest);
}
```

Key points:

- The API key **never leaves the server**.
- `capability` is locked to `lesson:*` presence + subscribe only — clients cannot publish arbitrary messages or access other channel namespaces.
- `clientId` is the user's integer ID (as string) so Ably can deduplicate across tabs for the same user.

---

## Client: React integration

**Package**: `ably` (the official SDK; includes React hooks as of v2).

### Provider setup (root layout or lesson layout)

```tsx
import Ably from "ably";
import { AblyProvider, ChannelProvider } from "ably/react";

const client = new Ably.Realtime({ authUrl: "/api/ably/token" });

// Wrap the lesson route:
<AblyProvider client={client}>
  <ChannelProvider channelName={`lesson:${lessonId}`}>
    <LessonPage />
  </ChannelProvider>
</AblyProvider>;
```

### Presence hooks in the lesson component

```tsx
import { usePresence, usePresenceListener } from "ably/react";

// Enter the presence set with user data as payload:
usePresence(`lesson:${lessonId}`, {
  name: currentUser.name,
  avatarUrl: currentUser.avatarUrl,
});

// Read the full live presence set:
const { presenceData } = usePresenceListener(`lesson:${lessonId}`);

// presenceData is PresenceMessage[]:
// [{ clientId: "42", data: { name: "Alice", avatarUrl: "..." }, action: "present" }, ...]
```

`usePresence` handles `presence.enter()` on mount and `presence.leave()` on unmount automatically.

---

## Channel naming

Pattern: `lesson:{lessonId}` (e.g., `lesson:17`).

The colon is Ably's **namespace separator**. This means all lesson channels share the `lesson` namespace, allowing a single capability rule `lesson:*` to cover them all.

---

## UI: Avatar stack

Render at the top of the lesson page, alongside the lesson title or in the header.

- Show up to 4 avatars as overlapping circles.
- If more than 4 are present, show the first 3 + a "+N" overflow chip.
- Exclude the current user from the display (they know they're watching).
- Show a tooltip on hover with the full name.
- Display nothing (no empty state) when only the current user is present.

```tsx
const others = presenceData.filter((m) => m.clientId !== String(currentUserId));

// Render first 3 avatars + overflow
```

---

## Constraints and considerations

### Free tier

Ably's free tier covers **6M messages/month and 200 concurrent connections**. Each presence enter/leave/update is one message. At 200 peak concurrent students, the free tier is comfortably sufficient for early-stage usage.

### Single Ably client instance

Instantiate `Ably.Realtime` once per page load (outside component render), not inside a component body. Otherwise a new WebSocket connection is opened on every render.

### Multi-tab deduplication

If a user opens two tabs on the same lesson, Ably will show them as two distinct presence members (same `clientId`, different `connectionId`). This is generally acceptable behaviour. Ably does not deduplicate by `clientId` by default.

### Known hook cleanup issue

There is a known issue in `ably-js` (GitHub issue #1687) where `usePresence` may not call `presence.leave()` correctly on unmount in some React 18 strict mode scenarios. Verify behaviour in development and add an explicit `useEffect` cleanup if needed.

### No SSR compatibility

Ably's WebSocket client is browser-only. The `AblyProvider` and hooks must be rendered on the client side. In React Router v7, wrap the provider with a client-only boundary or use `clientLoader`/`useEffect` for initialization.

---

## Environment variable

```
ABLY_API_KEY=<key from Ably dashboard>
```

Add to `.env` (local) and deployment environment. Never commit.

---

## Open questions for implementation

1. **Where exactly in the lesson UI** does the avatar stack live — lesson header, sidebar, or floating badge?
2. **Should instructors be excluded** from the presence display (they may always be "present" for testing)?
3. **Should we show presence on the course overview page** (aggregating viewers across all lessons in a module), or lesson pages only?
