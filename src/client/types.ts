/**
 * @fileoverview 客户端用类型（加密配置与消息格式）
 * 仅用于 client 目录，无包内依赖，避免打包时与主 types 循环依赖
 */

/**
 * 加密配置
 */
export interface EncryptionConfig {
  /** 加密密钥（Uint8Array 或字符串） */
  key: Uint8Array | string;
  /** 加密算法（默认：aes-256-gcm） */
  algorithm?: "aes-256-gcm" | "aes-128-gcm" | "aes-256-cbc" | "aes-128-cbc";
  /** 是否启用加密（默认：true） */
  enabled?: boolean;
  /** 加密缓存大小（默认：1000） */
  cacheSize?: number;
  /** 加密缓存过期时间（毫秒，默认：60000） */
  cacheTTL?: number;
}

/**
 * 消息类型
 */
export type MessageType =
  | "event"
  | "ping"
  | "pong"
  | "callback"
  | "binary"
  | "error";

/**
 * WebSocket 消息格式
 */
export interface WebSocketMessage {
  /** 消息类型 */
  type: MessageType;
  /** 事件名称（当 type 为 "event" 时） */
  event?: string;
  /** 事件数据 */
  data?: any;
  /** 回调 ID（用于消息确认） */
  callbackId?: string;
}
