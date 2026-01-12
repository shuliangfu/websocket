/**
 * @fileoverview WebSocket 类型定义
 * 定义 WebSocket 服务器和 Socket 相关的类型和接口
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
 * WebSocket 服务器配置选项
 */
export interface ServerOptions {
  /** 主机地址（默认：0.0.0.0） */
  host?: string;
  /** 端口号 */
  port?: number;
  /** WebSocket 路径（默认："/"） */
  path?: string;
  /** 心跳超时时间（毫秒，默认：60000） */
  pingTimeout?: number;
  /** 心跳间隔（毫秒，默认：30000） */
  pingInterval?: number;
  /** 最大连接数（默认：无限制） */
  maxConnections?: number;
  /** 加密配置（可选，启用后服务端会自动解密消息） */
  encryption?: EncryptionConfig;
}

/**
 * WebSocket 握手信息
 */
export interface Handshake {
  /** 查询参数 */
  query: Record<string, string>;
  /** 请求头 */
  headers: Headers;
  /** 客户端地址 */
  address?: string;
  /** URL */
  url: string;
}

/**
 * Socket 数据存储
 */
export interface SocketData {
  [key: string]: unknown;
}

/**
 * Socket 事件监听器
 */
export type SocketEventListener = (
  data?: any,
  callback?: (response: any) => void,
) => void;

/**
 * 服务器事件监听器
 */
export type ServerEventListener = (socket: any) => void;

/**
 * 中间件函数
 */
export type Middleware = (
  socket: any,
  next: (error?: Error) => void,
) => void | Promise<void>;

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

// Socket 类型（前向声明，避免循环依赖）
// 实际类型定义在 socket.ts 中
