# @dreamer/websocket/client

> WebSocket client package for browser environments. Real-time bidirectional
> communication.

[![JSR](https://jsr.io/badges/@dreamer/websocket/client)](https://jsr.io/@dreamer/websocket/client)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](../../../LICENSE)

---

## Server support

For server-side WebSocket support, see [server documentation](../README.md).

## Overview

WebSocket client package for real-time communication in browser environments.

## Features

- **Browser WebSocket API**:
  - Standard WebSocket client
  - Uses native browser WebSocket API
- **Auto reconnect**:
  - Automatic reconnection on disconnect
  - Reconnection strategies (exponential backoff, fixed interval, etc.)
  - Max reconnection attempts
  - Reconnection state callbacks
- **Message queue**:
  - Offline message cache
  - Send queue
  - Message acknowledgment
  - Retransmission
- **Heartbeat**:
  - Auto heartbeat send
  - Server heartbeat response detection
  - Connection health monitoring
- **Events**:
  - Connection state events
  - Message events
  - Error handling
  - Custom event subscription
- **File upload**:
  - Binary file transfer
  - Chunked upload for large files
  - Upload progress callbacks
  - Upload cancellation
  - Concurrent multi-file upload

## Installation

```bash
deno add jsr:@dreamer/websocket/client
```

## Compatibility

- **Deno**: 2.5+
- **Environment**: Browser
- **Dependencies**: None

## Quick start

### Basic client

```typescript
import { Client } from "jsr:@dreamer/websocket/client";

const client = new Client({
  url: "ws://localhost:8080",
  autoReconnect: true,
  reconnectInterval: 1000,
  maxReconnectAttempts: 5,
});

client.on("open", () => {
  console.log("Connected");
});

client.on("message", (data) => {
  console.log("Message:", data);
});

client.on("close", (code, reason) => {
  console.log("Closed:", code, reason);
});

client.on("error", (error) => {
  console.error("Error:", error);
});

client.send("Hello, Server!");
client.close();
```

## Use cases

- **Real-time**: Chat, live support, notifications
- **Push**: Message push, status updates, data sync
- **Collaboration**: Collaborative editing, whiteboard, multiplayer games

---

## Notes

- **Browser WebSocket API**: Standard WebSocket API
- **Unified API**: Similar to server API for easier adoption
- **TypeScript**: Full type support
- **No external deps**: Pure TypeScript

---

## Contributing

Issues and Pull Requests welcome!

---

## License

Apache License 2.0 - see [LICENSE](../../../LICENSE)

---

<div align="center">

**Made with ❤️ by Dreamer Team**

</div>
