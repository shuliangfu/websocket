# @dreamer/websocket

> WebSocket utility library compatible with Deno, Bun, and Node.js 22+.
> Real-time bidirectional communication.

[![JSR](https://jsr.io/badges/@dreamer/websocket)](https://jsr.io/@dreamer/websocket)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)
[![Tests](https://img.shields.io/badge/tests-143%20passed%20(3%20runtimes)-brightgreen)](./docs/en-US/TEST_REPORT.md)

**Full docs**: [English](./docs/en-US/README.md) ·
[中文 (Chinese)](./docs/zh-CN/README.md)\
**Changelog**: [EN](./docs/en-US/CHANGELOG.md) |
[中文](./docs/zh-CN/CHANGELOG.md)

**Latest (v1.1.0 - 2026-07-23)**: **Added** – Node.js 22+ compatibility
(MongoDB adapter lazy-loaded, `serve()` awaited for Node's async
`ServeHandle`); integration tests split out. See
[Full changelog](./docs/en-US/CHANGELOG.md).

---

## Features

- **Cross-runtime**: Deno, Bun, and Node.js 22+, unified API via
  @dreamer/runtime-adapter
- **Connection**: Pool, limits, state tracking
- **Rooms & namespaces**: Join/leave, broadcast, per-namespace middleware
- **Client**: Browser client via `jsr:@dreamer/websocket/client`, auto-reconnect
- **Extras**: Message encryption, distributed adapters (Redis, MongoDB),
  heartbeat, middleware

## Installation

```bash
# Deno
deno add jsr:@dreamer/websocket
# client
deno add jsr:@dreamer/websocket/client

# Bun
bunx jsr add @dreamer/websocket

# Node.js 22+
npx jsr add @dreamer/websocket
```

## Compatibility

| Runtime  | Version | Status |
| -------- | ------- | ------ |
| Deno     | 2.9+    | ✅     |
| Bun      | 1.3+    | ✅     |
| Node.js  | 22+     | ✅     |

## Quick start

```typescript
import { Server } from "jsr:@dreamer/websocket";

const server = new Server({ port: 8080 });
server.on("connection", (socket) => {
  socket.on("message", (data) => {
    socket.broadcast(data);
  });
});
await server.listen();
```

- **Test report**: [en-US](./docs/en-US/TEST_REPORT.md) ·
  [zh-CN](./docs/zh-CN/TEST_REPORT.md)

See [docs/en-US/README.md](./docs/en-US/README.md) or
[docs/zh-CN/README.md](./docs/zh-CN/README.md) for full documentation.
