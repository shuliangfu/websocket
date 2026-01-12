/**
 * @fileoverview WebSocket 适配器模块
 * 导出所有适配器类型和实现
 */

// 导出类型
export type {
  AdapterOptions,
  MessageData,
  RoomInfo,
  WebSocketAdapter,
} from "./types.ts";

// 导出适配器实现
export { MemoryAdapter } from "./memory.ts";
export { MongoDBAdapter } from "./mongodb.ts";
export type {
  MongoDBAdapterOptions,
  MongoDBConnectionConfig,
} from "./mongodb.ts";
export { RedisAdapter } from "./redis.ts";
export type {
  RedisAdapterOptions,
  RedisConnectionConfig,
  RedisPubSubClient,
} from "./redis.ts";
