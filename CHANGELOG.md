# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [1.0.0] - 2026-02-06

### Added

First stable release. WebSocket utility library with server and client support, compatible with Deno and Bun. Real-time bidirectional communication, room management, namespaces, message encryption, and distributed adapters.

#### Core

- **Server**: WebSocket server with connection management, event system
- **Client**: Browser client via `jsr:@dreamer/websocket/client` with auto-reconnect
- **Cross-runtime**: Deno 2.5+ and Bun 1.0+, unified API via @dreamer/runtime-adapter

#### Connection & Message

- **Connection management**: Establishment, teardown, state tracking, pool management, limits
- **Message handling**: Text (UTF-8), binary (ArrayBuffer, Blob), JSON serialization, routing
- **Event system**: connect, disconnect, error, custom events, acknowledgments

#### Rooms & Namespaces

- **Rooms**: Create/destroy, join/leave, room broadcast, state queries
- **Namespaces**: Namespace isolation, per-namespace connection pool and middleware

#### Middleware

- **authMiddleware**: Authentication middleware
- **loggerMiddleware**: Connection logging
- **rateLimitMiddleware**: Connection and message rate limiting
- **corsMiddleware**: CORS with origin validation

#### Message Encryption

- **EncryptionManager**: AES-256-GCM, AES-128-GCM, AES-256-CBC, AES-128-CBC
- **Key management**: Random generation, password derivation
- **Auto encrypt/decrypt**: Transparent message encryption

#### Distributed Adapters

- **MemoryAdapter**: Default in-memory adapter
- **RedisAdapter**: Redis Pub/Sub for multi-server sync
- **MongoDBAdapter**: MongoDB Change Streams or polling for multi-server sync
- **Single-node replica set**: Support for single-node MongoDB replica set

#### Performance

- **MessageCache**: Message serialization cache, FNV-1a hash, LRU eviction
- **MessageQueue**: Broadcast via queue (`useMessageQueue`), backpressure
- **BatchHeartbeatManager**: Batch heartbeat (`useBatchHeartbeat`), fewer timers
- **getStats**: Server stats including messageQueue, messageCache

#### Logging & i18n

- **Custom logger**: `logger`, `debug`, `t` translation function
- **Debug logs**: Same behavior as @dreamer/server

#### Exports

- **Server**: Server, Socket, Namespace, NamespaceManager, RoomManager
- **Middleware**: authMiddleware, loggerMiddleware, rateLimitMiddleware, corsMiddleware
- **Adapters**: MemoryAdapter, RedisAdapter, MongoDBAdapter
- **Utilities**: EncryptionManager, MessageCache, MessageQueue, BatchHeartbeatManager, HeartbeatManager
- **Message**: parseMessage, serializeMessage, isEventMessage, isBinaryMessage, etc.
- **Types**: ServerOptions, ClientOptions, Handshake, Middleware, SocketData, EncryptionConfig, etc.
