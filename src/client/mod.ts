/**
 * @module @dreamer/websocket/client
 *
 * WebSocket 客户端库，提供 WebSocket 客户端功能，支持实时双向通信。
 *
 * 功能特性：
 * - WebSocket 客户端：基于浏览器 WebSocket API 的客户端
 * - 自动重连：断线自动重连、重连策略、最大重连次数限制
 * - 消息队列：离线消息缓存、消息发送队列、消息确认机制
 * - 心跳检测：自动心跳发送、服务器心跳响应检测
 * - 事件处理：连接状态事件、消息接收事件、错误处理事件
 *
 * @example
 * ```typescript
 * import { Client } from "jsr:@dreamer/websocket/client";
 *
 * const client = new Client({
 *   url: "ws://localhost:8080",
 *   autoReconnect: true,
 * });
 *
 * client.on("open", () => {
 *   client.emit("chat-message", { text: "Hello" });
 * });
 * ```
 */

export * from "./types.ts";
export * from "./encryption.ts";
export * from "./message.ts";
export * from "./client.ts";
