## [1.0.5] - 2026-02-20

### Changed

- i18n: auto-init on module load (no longer export `initWebSocketI18n`).
  Dependencies: bump @dreamer/crypto, @dreamer/test, @dreamer/runtime-adapter,
  @dreamer/logger.

---

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [1.0.4] - 2026-02-19

### Changed

- **i18n**: Renamed translation method from `$t` to `$tr` to avoid conflict with
  global `$t`. Update existing code to use `$tr` for package messages.

### Fixed

- **Tests**: `logger-debug-i18n.test.ts` updated to use `$tr` instead of `$t`.
  MessageQueue onError test now accepts both English and Chinese message (locale
  may be en-US or zh-CN from environment).

---

## [1.0.3] - 2026-02-18

### Removed

- **`tr` method and all references**: Server and middleware no longer expose or
  use `tr`. I18n uses `$t(key, params, lang)` with `options.lang` only.
- **Client `t` / `lang` options**: Client error messages are hardcoded in
  English; no translation API.
- **Adapter options `t`**: Adapter types and implementations use package `$t`
  directly; the optional `t` callback was removed from adapter options.

### Changed

- **Middleware**: Replaced `socket.getServer()?.tr?.(...)` with
  `$t(..., socket.getServer()?.options?.lang)` in auth, logger, rateLimit.
- **Socket**: Sets locale in constructor via
  `setWebSocketLocale(server.options.lang)`; all `$t` calls in Socket omit the
  lang parameter (use current locale).
- **MessageQueue**: Uses
  `$t("log.websocket.messageSendFailed", { error }, server?.options?.lang)`.
- **MongoDB adapter**: Removed unused variable in replica-set error path.

### Fixed

- **Tests**: MessageQueue onError test expects English "Message send failed";
  logger/auth i18n test descriptions updated (no `server.tr` references).

---

## [1.0.2] - 2026-02-18

### Changed

- **License**: License set to Apache 2.0.
- **ServerOptions**: Replaced optional `t?(key, params)` with
  `lang?: "en-US" | "zh-CN"`. Server now uses built-in i18n; set `lang` in
  constructor to fix locale, or leave unset for env-based detection (LANGUAGE /
  LC_ALL / LANG).

### Added

- **i18n (source)**: Server integrates `@dreamer/i18n`. Entry calls
  `initWebSocketI18n()` to load en-US/zh-CN; `Server#tr()` uses package `$t()`.
  Locale files: `src/locales/en-US.json`, `src/locales/zh-CN.json` for
  `log.websocket.*`, `log.adapterRedis.*`, `log.adapterMongo.*`,
  `log.websocketClient.*` (connectionEstablished, authFailed, authError, etc.).
- **Documentation**: Restructured into `docs/en-US` and `docs/zh-CN`. Full
  README, CHANGELOG, TEST_REPORT, and client README in both languages. Root
  README shortened with links to full docs and changelogs.
- **TEST_REPORT**: Full Chinese translation for `docs/zh-CN/TEST_REPORT.md`.

### Updated

- **Tests**: `logger-debug-i18n.test.ts` updated to use `lang: "en-US"` instead
  of `t`; assertions aligned with built-in translations.

---

## [1.0.1] - 2026-02-08

### Fixed

- **Windows CI compatibility**: Use `port: 0` + `server.getPort()` instead of
  `getAvailablePort()` to fix port conflicts (PermissionDenied 10013,
  AddrInUse 10048) on Windows CI runners

---

## [1.0.0] - 2026-02-06

### Added

First stable release. WebSocket utility library with server and client support,
compatible with Deno and Bun. Real-time bidirectional communication, room
management, namespaces, message encryption, and distributed adapters.

#### Core

- **Server**: WebSocket server with connection management, event system
- **Client**: Browser client via `jsr:@dreamer/websocket/client` with
  auto-reconnect
- **Cross-runtime**: Deno 2.5+ and Bun 1.0+, unified API via
  @dreamer/runtime-adapter

#### Connection & Message

- **Connection management**: Establishment, teardown, state tracking, pool
  management, limits
- **Message handling**: Text (UTF-8), binary (ArrayBuffer, Blob), JSON
  serialization, routing
- **Event system**: connect, disconnect, error, custom events, acknowledgments

#### Rooms & Namespaces

- **Rooms**: Create/destroy, join/leave, room broadcast, state queries
- **Namespaces**: Namespace isolation, per-namespace connection pool and
  middleware

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
- **Middleware**: authMiddleware, loggerMiddleware, rateLimitMiddleware,
  corsMiddleware
- **Adapters**: MemoryAdapter, RedisAdapter, MongoDBAdapter
- **Utilities**: EncryptionManager, MessageCache, MessageQueue,
  BatchHeartbeatManager, HeartbeatManager
- **Message**: parseMessage, serializeMessage, isEventMessage, isBinaryMessage,
  etc.
- **Types**: ServerOptions, ClientOptions, Handshake, Middleware, SocketData,
  EncryptionConfig, etc.
