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

/// <reference lib="dom" />

/**
 * WebSocket 客户端配置选项
 */
export interface ClientOptions {
  /** WebSocket 服务器 URL */
  url: string;
  /** 是否自动重连（默认：true） */
  autoReconnect?: boolean;
  /** 重连间隔（毫秒，默认：1000） */
  reconnectInterval?: number;
  /** 最大重连次数（默认：5，0 表示无限制） */
  maxReconnectAttempts?: number;
  /** 重连策略（默认：exponential） */
  reconnectStrategy?: "exponential" | "fixed" | "linear";
  /** 心跳间隔（毫秒，默认：30000） */
  pingInterval?: number;
  /** 心跳超时（毫秒，默认：60000） */
  pingTimeout?: number;
  /** 查询参数 */
  query?: Record<string, string>;
  /** 协议列表 */
  protocols?: string[];
}

/**
 * 客户端事件监听器
 */
export type ClientEventListener = (data?: any) => void;

/**
 * WebSocket 客户端类
 */
export class Client {
  /** 配置选项 */
  private options:
    & Required<
      Pick<
        ClientOptions,
        | "autoReconnect"
        | "reconnectInterval"
        | "maxReconnectAttempts"
        | "reconnectStrategy"
        | "pingInterval"
        | "pingTimeout"
      >
    >
    & ClientOptions;
  /** WebSocket 连接 */
  private ws?: WebSocket;
  /** 是否已连接 */
  public connected = false;
  /** 重连次数 */
  private reconnectAttempts = 0;
  /** 重连定时器 */
  private reconnectTimer?: number;
  /** 心跳定时器 */
  private pingTimer?: number;
  /** 心跳超时定时器 */
  private pingTimeoutTimer?: number;
  /** 事件监听器 */
  private listeners: Map<string, ClientEventListener[]> = new Map();
  /** 消息队列（离线时缓存消息） */
  private messageQueue: Array<{ event: string; data?: any }> = [];
  /** 连接状态 */
  private state: "connecting" | "connected" | "disconnected" | "reconnecting" =
    "disconnected";

  /**
   * 创建 WebSocket 客户端实例
   * @param options 客户端配置选项
   */
  constructor(options: ClientOptions) {
    this.options = {
      autoReconnect: options.autoReconnect !== false,
      reconnectInterval: options.reconnectInterval || 1000,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 5,
      reconnectStrategy: options.reconnectStrategy || "exponential",
      pingInterval: options.pingInterval || 30000,
      pingTimeout: options.pingTimeout || 60000,
      ...options,
    };

    // 自动连接
    this.connect();
  }

  /**
   * 连接 WebSocket 服务器
   */
  connect(): void {
    if (this.state === "connecting" || this.state === "connected") {
      return;
    }

    this.state = "connecting";

    try {
      // 构建 URL（添加查询参数）
      const url = this.buildUrl();

      // 创建 WebSocket 连接
      this.ws = new WebSocket(url, this.options.protocols);

      // 设置事件处理
      this.setupEventHandlers();
    } catch (error) {
      this.handleError(error);
      this.handleReconnect();
    }
  }

  /**
   * 构建 WebSocket URL
   * @returns WebSocket URL
   */
  private buildUrl(): string {
    const url = new URL(this.options.url);
    if (this.options.query) {
      for (const [key, value] of Object.entries(this.options.query)) {
        url.searchParams.append(key, value);
      }
    }
    return url.toString();
  }

  /**
   * 设置事件处理
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.addEventListener("open", () => {
      this.handleOpen();
    });

    this.ws.addEventListener("message", (event) => {
      this.handleMessage(event.data);
    });

    this.ws.addEventListener("close", (event) => {
      this.handleClose(event.code, event.reason);
    });

    this.ws.addEventListener("error", (error) => {
      this.handleError(error);
    });
  }

  /**
   * 处理连接打开
   */
  private handleOpen(): void {
    this.state = "connected";
    this.connected = true;
    this.reconnectAttempts = 0;

    // 清空重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    // 设置心跳检测
    this.setupHeartbeat();

    // 发送队列中的消息
    this.flushMessageQueue();

    // 触发连接事件
    this.emit("open");
  }

  /**
   * 处理消息
   * @param data 消息数据
   */
  private handleMessage(data: string | ArrayBuffer | Blob): void {
    try {
      const message = this.parseMessage(data);

      // 处理心跳响应
      if (message.type === "pong") {
        this.handlePong();
        return;
      }

      // 处理心跳请求
      if (message.type === "ping") {
        this.send({ type: "pong" });
        return;
      }

      // 处理事件消息
      if (message.type === "event" && message.event) {
        this.emit(message.event, message.data);
      }
    } catch (error) {
      this.emit("error", error);
    }
  }

  /**
   * 解析消息
   * @param data 消息数据
   * @returns 解析后的消息
   */
  private parseMessage(data: string | ArrayBuffer | Blob): any {
    if (typeof data === "string") {
      return JSON.parse(data);
    }
    // 二进制消息暂不支持复杂解析
    return { type: "binary", data };
  }

  /**
   * 处理连接关闭
   * @param code 关闭代码
   * @param reason 关闭原因
   */
  private handleClose(code: number, reason: string): void {
    this.state = "disconnected";
    this.connected = false;

    // 清理心跳定时器
    this.cleanupHeartbeat();

    // 触发关闭事件
    this.emit("close", { code, reason });

    // 处理重连
    if (this.options.autoReconnect) {
      this.handleReconnect();
    }
  }

  /**
   * 处理错误
   * @param error 错误对象
   */
  private handleError(error: unknown): void {
    this.emit("error", error);
  }

  /**
   * 处理重连
   */
  private handleReconnect(): void {
    if (
      this.options.maxReconnectAttempts > 0 &&
      this.reconnectAttempts >= this.options.maxReconnectAttempts
    ) {
      this.emit("reconnect_failed");
      return;
    }

    this.state = "reconnecting";
    this.reconnectAttempts++;

    // 计算重连延迟
    const delay = this.calculateReconnectDelay();

    // 设置重连定时器
    this.reconnectTimer = setTimeout(() => {
      this.emit("reconnect_attempt", this.reconnectAttempts);
      this.connect();
    }, delay) as unknown as number;
  }

  /**
   * 计算重连延迟
   * @returns 延迟时间（毫秒）
   */
  private calculateReconnectDelay(): number {
    const baseInterval = this.options.reconnectInterval;

    switch (this.options.reconnectStrategy) {
      case "exponential":
        return baseInterval * Math.pow(2, this.reconnectAttempts - 1);
      case "linear":
        return baseInterval * this.reconnectAttempts;
      case "fixed":
      default:
        return baseInterval;
    }
  }

  /**
   * 设置心跳检测
   */
  private setupHeartbeat(): void {
    const pingInterval = this.options.pingInterval;
    const pingTimeout = this.options.pingTimeout;

    // 发送心跳
    this.pingTimer = setInterval(() => {
      if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: "ping" });
        // 设置超时定时器
        this.pingTimeoutTimer = setTimeout(() => {
          if (this.connected) {
            this.ws?.close();
          }
        }, pingTimeout) as unknown as number;
      }
    }, pingInterval) as unknown as number;
  }

  /**
   * 处理心跳响应
   */
  private handlePong(): void {
    if (this.pingTimeoutTimer) {
      clearTimeout(this.pingTimeoutTimer);
      this.pingTimeoutTimer = undefined;
    }
  }

  /**
   * 清理心跳定时器
   */
  private cleanupHeartbeat(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
    if (this.pingTimeoutTimer) {
      clearTimeout(this.pingTimeoutTimer);
      this.pingTimeoutTimer = undefined;
    }
  }

  /**
   * 发送消息
   * @param message 消息对象
   */
  private send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // 如果未连接，将消息加入队列
      if (message.type === "event") {
        this.messageQueue.push({
          event: message.event,
          data: message.data,
        });
      }
    }
  }

  /**
   * 清空消息队列
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.emit(message.event, message.data);
      }
    }
  }

  /**
   * 监听事件
   * @param event 事件名称
   * @param listener 事件监听器
   */
  on(event: string, listener: ClientEventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  /**
   * 取消监听事件
   * @param event 事件名称
   * @param listener 事件监听器（可选，不提供则移除所有监听器）
   */
  off(event: string, listener?: ClientEventListener): void {
    if (!listener) {
      this.listeners.delete(event);
      return;
    }

    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * 发送事件
   * @param event 事件名称
   * @param data 事件数据
   */
  emit(event: string, data?: any): void {
    // 触发本地事件监听器
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        listener(data);
      }
    }

    // 发送到服务器
    this.send({
      type: "event",
      event,
      data,
    });
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.options.autoReconnect = false;

    // 清理定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.cleanupHeartbeat();

    // 关闭 WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }

    this.state = "disconnected";
    this.connected = false;
  }

  /**
   * 获取连接状态
   * @returns 连接状态
   */
  getState(): "connecting" | "connected" | "disconnected" | "reconnecting" {
    return this.state;
  }
}
