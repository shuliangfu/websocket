import { EncryptionManager } from "./encryption.ts";
import { parseMessage, serializeMessage } from "./message.ts";
import type { EncryptionConfig, WebSocketMessage } from "./types.ts";

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
  /** 加密配置（可选，启用后客户端会自动加密消息） */
  encryption?: EncryptionConfig;
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
  /** 加密管理器（用于自动加密消息） */
  private encryptionManager?: EncryptionManager;

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

    // 初始化加密管理器（如果配置了加密）
    if (this.options.encryption) {
      this.encryptionManager = new EncryptionManager(this.options.encryption);
    }

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
  private handleMessage(data: string | ArrayBuffer | Blob | Uint8Array): void {
    // 如果是二进制消息，直接触发 binary 事件（不通过 emit，避免自动发送）
    // Bun 环境下可能返回 Uint8Array，Deno 环境下返回 ArrayBuffer 或 Blob
    if (
      data instanceof ArrayBuffer ||
      data instanceof Blob ||
      data instanceof Uint8Array
    ) {
      // 如果是 Uint8Array，转换为 ArrayBuffer
      let binaryData: ArrayBuffer | Blob;
      if (data instanceof Uint8Array) {
        const buffer = data.buffer.slice(
          data.byteOffset,
          data.byteOffset + data.byteLength,
        );
        // 处理 SharedArrayBuffer 的情况
        if (buffer instanceof SharedArrayBuffer) {
          const newBuffer = new ArrayBuffer(buffer.byteLength);
          new Uint8Array(newBuffer).set(new Uint8Array(buffer));
          binaryData = newBuffer;
        } else {
          binaryData = buffer;
        }
      } else {
        binaryData = data;
      }
      const listeners = this.listeners.get("binary");
      if (listeners) {
        for (const listener of listeners) {
          listener(binaryData);
        }
      }
      return;
    }

    // 异步处理消息（支持解密）
    this.parseMessage(data).then((message: WebSocketMessage) => {
      // 处理心跳响应
      if (message.type === "pong") {
        this.handlePong();
        return;
      }

      // 处理心跳请求
      if (message.type === "ping") {
        this.send({ type: "pong" }).catch(() => {
          // 忽略发送失败的错误
        });
        return;
      }

      // 处理二进制消息（不通过 emit，避免自动发送）
      if (message.type === "binary") {
        const listeners = this.listeners.get("binary");
        if (listeners) {
          for (const listener of listeners) {
            listener(message.data);
          }
        }
        return;
      }

      // 处理事件消息
      if (message.type === "event" && message.event) {
        this.emit(message.event, message.data);
      }

      // 处理回调消息
      if (message.type === "callback" && message.callbackId) {
        this.emit("callback", message.data);
      }
    }).catch((error: unknown) => {
      this.emit("error", error);
    });
  }

  /**
   * 解析消息（支持自动解密）
   * @param data 消息数据
   * @returns 解析后的消息
   */
  private async parseMessage(
    data: string | ArrayBuffer | Blob,
  ): Promise<WebSocketMessage> {
    return await parseMessage(data, this.encryptionManager);
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
   * 发送消息（支持自动加密）
   * @param message 消息对象
   */
  private async send(message: WebSocketMessage): Promise<void> {
    // 序列化消息（自动加密）
    const serialized = await serializeMessage(message, this.encryptionManager);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(serialized);
    } else {
      // 如果未连接，将消息加入队列
      if (message.type === "event") {
        this.messageQueue.push({
          event: message.event!,
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
   * @param data 事件数据（支持任意类型，包括二进制数据）
   * @param callback 确认回调函数（可选，用于消息确认机制）
   */
  emit(
    event: string,
    data?: any,
    callback?: (response: any) => void,
  ): void {
    // 触发本地事件监听器
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        listener(data);
      }
    }

    // 如果数据是二进制类型，直接发送二进制（不支持回调）
    if (
      data instanceof ArrayBuffer ||
      data instanceof Blob ||
      data instanceof Uint8Array
    ) {
      this.sendBinary(data);
      return;
    }

    // 如果有回调函数，生成回调ID并注册回调
    let callbackId: string | undefined;
    if (callback) {
      callbackId = `${Date.now()}-${
        Math.random().toString(36).substring(2, 9)
      }`;
      // 注册一次性回调监听器
      const callbackListener = (responseData: any) => {
        callback(responseData);
        // 移除监听器
        this.off("callback", callbackListener);
      };
      this.on("callback", callbackListener);
    }

    // 发送到服务器（JSON 格式）
    this.send({
      type: "event",
      event,
      data,
      callbackId,
    });
  }

  /**
   * 发送二进制消息
   * @param data 二进制数据（ArrayBuffer、Blob 或 Uint8Array）
   */
  sendBinary(data: ArrayBuffer | Blob | Uint8Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected, cannot send binary");
    }

    // 将 Uint8Array 转换为 ArrayBuffer
    let binaryData: ArrayBuffer | Blob;
    if (data instanceof Uint8Array) {
      // 创建一个新的 ArrayBuffer 并复制数据，避免 SharedArrayBuffer 类型问题
      const buffer = data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength,
      );
      if (buffer instanceof SharedArrayBuffer) {
        // 如果是 SharedArrayBuffer，创建新的 ArrayBuffer 并复制数据
        const newBuffer = new ArrayBuffer(buffer.byteLength);
        new Uint8Array(newBuffer).set(new Uint8Array(buffer));
        binaryData = newBuffer;
      } else {
        binaryData = buffer;
      }
    } else {
      binaryData = data;
    }

    this.ws.send(binaryData);
  }

  /**
   * 上传文件（分片上传）
   * @param file 文件对象（File 或 Blob）
   * @param options 上传选项
   * @returns 上传进度回调函数
   */
  uploadFile(
    file: File | Blob,
    options?: {
      chunkSize?: number; // 分片大小（字节，默认：64KB）
      onProgress?: (progress: number) => void; // 进度回调（0-100）
      onComplete?: () => void; // 完成回调
      onError?: (error: Error) => void; // 错误回调
    },
  ): { cancel: () => void } {
    const chunkSize = options?.chunkSize || 64 * 1024; // 默认 64KB
    const totalChunks = Math.ceil(file.size / chunkSize);
    let currentChunk = 0;
    let cancelled = false;

    // 生成唯一的上传ID（客户端生成，确保唯一性）
    const uploadId = `${Date.now()}-${
      Math.random().toString(36).substring(2, 9)
    }-${file instanceof File ? file.name : "blob"}`;

    const uploadChunk = async (chunkIndex: number) => {
      if (cancelled || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
        if (options?.onError) {
          options.onError(new Error("Upload cancelled or connection closed"));
        }
        return;
      }

      const start = chunkIndex * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);

      try {
        // 发送分片元数据（JSON），包含uploadId
        this.send({
          type: "event",
          event: "file-chunk",
          data: {
            uploadId, // 传递唯一的上传ID
            fileName: file instanceof File ? file.name : "blob",
            fileSize: file.size,
            chunkIndex,
            totalChunks,
            chunkSize: chunk.size,
          },
        });

        // 发送分片数据（二进制）
        await new Promise<void>((resolve, reject) => {
          if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            reject(new Error("Connection closed"));
            return;
          }

          const reader = new FileReader();
          reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) {
              this.ws!.send(reader.result);
              resolve();
            } else {
              reject(new Error("Failed to read file chunk"));
            }
          };
          reader.onerror = () => reject(new Error("Failed to read file chunk"));
          reader.readAsArrayBuffer(chunk);
        });

        currentChunk++;
        const progress = Math.round((currentChunk / totalChunks) * 100);

        if (options?.onProgress) {
          options.onProgress(progress);
        }

        if (currentChunk < totalChunks) {
          // 继续上传下一个分片
          setTimeout(() => uploadChunk(currentChunk), 10);
        } else {
          // 上传完成
          if (options?.onComplete) {
            options.onComplete();
          }
        }
      } catch (error) {
        if (options?.onError) {
          options.onError(
            error instanceof Error ? error : new Error("Upload failed"),
          );
        }
      }
    };

    // 开始上传
    uploadChunk(0);

    return {
      cancel: () => {
        cancelled = true;
      },
    };
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
