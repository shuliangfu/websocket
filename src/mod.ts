/**
 * @module @dreamer/websocket
 *
 * WebSocket 工具库，提供 WebSocket 服务器功能，支持实时双向通信。
 *
 * 功能特性：
 * - WebSocket 服务器：基于 runtime-adapter 的 WebSocket 服务器，兼容 Deno 和 Bun
 * - 连接管理：连接建立、关闭、状态追踪、连接池管理
 * - 消息处理：文本消息、二进制消息、消息序列化/反序列化
 * - 房间管理：房间创建、用户加入/离开、房间内消息广播
 * - 心跳检测：自动心跳发送、连接超时检测、断线重连支持
 * - 事件系统：连接事件、消息事件、自定义事件支持
 * - 命名空间：支持命名空间隔离不同业务场景
 * - 中间件：提供认证、日志、限流等内置中间件
 *
 * @example
 * ```typescript
 * import { Server } from "jsr:@dreamer/websocket";
 *
 * const io = new Server({
 *   port: 8080,
 *   path: "/socket.io",
 * });
 *
 * io.on("connection", (socket) => {
 *   socket.on("chat-message", (data) => {
 *     socket.emit("chat-response", { status: "success" });
 *   });
 * });
 *
 * await io.listen();
 * ```
 */

// 服务端 i18n：入口加载文案并设置 locale（仅服务端）
import { initWebSocketI18n } from "./i18n.ts";
initWebSocketI18n();

// 导出类型
export type {
  EncryptionConfig,
  Handshake,
  MessageType,
  Middleware,
  ServerEventListener,
  ServerOptions,
  SocketData,
  SocketEventListener,
  WebSocketMessage,
} from "./types.ts";

// 导出主要类
export { Server } from "./server.ts";
export { Socket } from "./socket.ts";

// 导出类型（Server 的 getStats 返回类型）
export type ServerStats = {
  totalConnections: number;
  totalRooms: number;
  connectionsByRoom: Map<string, number>;
};

// 导出功能模块
export { BatchHeartbeatManager } from "./batch-heartbeat.ts";
export { HeartbeatManager } from "./heartbeat.ts";
export {
  getGlobalMessageCache,
  MessageCache,
  setGlobalMessageCache,
} from "./message-cache.ts";
export {
  MessageQueue,
  type MessageQueueErrorHandler,
} from "./message-queue.ts";
export { Namespace, NamespaceManager } from "./namespace.ts";
export { RoomManager } from "./room.ts";

// 导出消息处理函数
export {
  isBinaryMessage,
  isCallbackMessage,
  isEventMessage,
  isHeartbeatMessage,
  parseMessage,
  serializeMessage,
  serializeMessageToBinary,
} from "./message.ts";

// 导出中间件
export {
  authMiddleware,
  corsMiddleware,
  loggerMiddleware,
  rateLimitMiddleware,
} from "./middleware.ts";

// 导出加密模块
export { EncryptionManager } from "./encryption.ts";

// 导出适配器模块
export * from "./adapters/mod.ts";
