/**
 * @fileoverview WebSocket Socket 类
 * 表示一个 WebSocket 连接，处理消息收发、事件监听、房间管理等
 */

import { EncryptionManager } from "./encryption.ts";
import { HeartbeatManager } from "./heartbeat.ts";
import { isEventMessage, parseMessage, serializeMessage } from "./message.ts";
import type { Server } from "./server.ts";
import type {
  Handshake,
  SocketData,
  SocketEventListener,
  WebSocketMessage,
} from "./types.ts";

/**
 * WebSocket Socket 类
 * 表示一个 WebSocket 连接
 */
export class Socket {
  /** Socket ID（唯一标识） */
  public readonly id: string;
  /** 握手信息 */
  public readonly handshake: Handshake;
  /** 数据存储 */
  public data: SocketData = {};
  /** 是否已连接 */
  public connected = true;
  /** 房间列表 */
  private rooms: Set<string> = new Set();
  /** 事件监听器 */
  private listeners: Map<string, SocketEventListener[]> = new Map();
  /** WebSocket 连接（可能是 WebSocket 或 WebSocketAdapter） */
  private ws: WebSocket | {
    addEventListener: (type: string, listener: (event: any) => void) => void;
    send: (data: string | ArrayBuffer | Blob) => void;
    close: (code?: number, reason?: string) => void;
    readyState: number;
  };
  /** 服务器实例 */
  private server: Server;
  /** 心跳管理器 */
  private heartbeatManager?: HeartbeatManager;
  /** 文件上传状态（上传ID -> 上传信息） */
  private fileUploads: Map<
    string,
    {
      fileName: string;
      fileSize: number;
      totalChunks: number;
      chunks: Map<number, Uint8Array>;
      receivedChunks: number;
      createdAt: number; // 创建时间，用于超时检测
    }
  > = new Map();
  /** 文件上传超时定时器（上传ID -> 定时器） */
  private fileUploadTimers: Map<string, number> = new Map();
  /** 当前正在等待二进制数据的上传ID（用于关联元数据和二进制数据） */
  private pendingBinaryUploadId: string | null = null;
  /** 加密管理器（用于自动解密消息） */
  private encryptionManager?: EncryptionManager;

  /**
   * 创建 Socket 实例
   * @param ws WebSocket 连接
   * @param server 服务器实例
   * @param handshake 握手信息
   * @param encryptionManager 加密管理器（可选，用于自动解密消息）
   */
  constructor(
    ws: WebSocket,
    server: Server,
    handshake: Handshake,
    encryptionManager?: EncryptionManager,
  ) {
    if (!ws || typeof ws !== "object") {
      throw new Error(`无效的 WebSocket 对象: ${typeof ws}`);
    }

    // 检查是否有必要的方法（在 Bun 环境下，ws 应该是 WebSocketAdapter）
    if (
      typeof (ws as any).addEventListener !== "function" &&
      typeof (ws as any).onmessage === "undefined"
    ) {
      throw new Error("构造函数接收到的 WebSocket 对象缺少必要的方法");
    }

    this.ws = ws;
    this.server = server;
    this.handshake = handshake;
    this.id = this.generateId();
    this.encryptionManager = encryptionManager;

    // 设置消息处理（在连接建立之前就设置，适配器会正确处理）
    this.setupMessageHandler();

    // 设置心跳检测
    this.setupHeartbeat();

    // 设置关闭处理
    this.setupCloseHandler();
  }

  /**
   * 生成唯一 ID
   * @returns Socket ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 设置消息处理
   */
  private setupMessageHandler(): void {
    const messageHandler = async (event: MessageEvent) => {
      try {
        // 如果是二进制消息，直接处理，不经过 parseMessage
        // Bun 环境下可能返回 Uint8Array，Deno 环境下返回 ArrayBuffer 或 Blob
        if (
          event.data instanceof ArrayBuffer ||
          event.data instanceof Blob ||
          event.data instanceof Uint8Array
        ) {
          // 如果是 Uint8Array，转换为 ArrayBuffer
          let binaryData: ArrayBuffer | Blob;
          if (event.data instanceof Uint8Array) {
            const buffer = event.data.buffer.slice(
              event.data.byteOffset,
              event.data.byteOffset + event.data.byteLength,
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
            binaryData = event.data;
          }
          this.handleBinaryMessage(binaryData);
          return;
        }

        // 解析消息（自动解密）
        const message = await parseMessage(event.data, this.encryptionManager);

        // 处理心跳响应
        if (message.type === "pong") {
          this.heartbeatManager?.handlePong();
          return;
        }

        // 处理二进制消息（可能是文件分片）
        if (message.type === "binary") {
          this.handleBinaryMessage(event.data);
          return;
        }

        // 处理文件上传元数据
        if (
          isEventMessage(message) &&
          message.event === "file-chunk" &&
          message.data
        ) {
          this.handleFileChunkMetadata(message.data);
          return;
        }

        // 处理回调消息
        if (message.type === "callback" && message.callbackId) {
          this.emit("callback", message.data);
          return;
        }

        // 处理错误消息
        if (message.type === "error") {
          this.emit("error", message.data);
          return;
        }

        // 处理自定义事件
        if (isEventMessage(message)) {
          this.handleEvent(message.event!, message.data, message.callbackId);
        }
      } catch (error) {
        this.emit("error", error);
      }
    };

    if (!this.ws) {
      throw new Error("WebSocket 对象未初始化");
    }

    // 检查是否有 addEventListener 方法
    if (typeof (this.ws as any).addEventListener === "function") {
      (this.ws as any).addEventListener("message", messageHandler);
    } else if (typeof (this.ws as any).onmessage !== "undefined") {
      (this.ws as any).onmessage = messageHandler;
    } else {
      throw new Error(
        `WebSocket 对象不支持消息监听。类型: ${typeof this.ws}, 属性: ${
          Object.keys(this.ws || {}).join(", ")
        }`,
      );
    }
  }

  /**
   * 处理二进制消息（文件分片）
   * @param data 二进制数据
   */
  private handleBinaryMessage(data: string | ArrayBuffer | Blob): void {
    // 如果有待处理的上传，处理二进制分片
    if (this.pendingBinaryUploadId) {
      const upload = this.fileUploads.get(this.pendingBinaryUploadId);
      if (upload && upload.receivedChunks < upload.totalChunks) {
        const nextChunkIndex = upload.receivedChunks;

        // 处理二进制数据
        if (data instanceof ArrayBuffer) {
          const chunkData = new Uint8Array(data);
          upload.chunks.set(nextChunkIndex, chunkData);
          upload.receivedChunks++;

          // 检查是否所有分片都已接收
          if (upload.receivedChunks === upload.totalChunks) {
            this.completeFileUpload(this.pendingBinaryUploadId, upload);
            this.pendingBinaryUploadId = null;
          }
          return;
        } else if (data instanceof Blob) {
          // Blob 需要异步读取
          const currentUploadId = this.pendingBinaryUploadId; // 保存当前上传ID
          const reader = new FileReader();
          reader.onload = () => {
            if (reader.result instanceof ArrayBuffer && currentUploadId) {
              const currentUpload = this.fileUploads.get(currentUploadId);
              if (currentUpload) {
                const chunkData = new Uint8Array(reader.result);
                currentUpload.chunks.set(nextChunkIndex, chunkData);
                currentUpload.receivedChunks++;

                // 检查是否所有分片都已接收
                if (
                  currentUpload.receivedChunks === currentUpload.totalChunks
                ) {
                  this.completeFileUpload(currentUploadId, currentUpload);
                  if (this.pendingBinaryUploadId === currentUploadId) {
                    this.pendingBinaryUploadId = null;
                  }
                }
              }
            }
          };
          reader.onerror = () => {
            // 读取失败，清理上传状态
            if (currentUploadId) {
              this.cleanupFileUpload(currentUploadId, "读取文件分片失败");
            }
          };
          reader.readAsArrayBuffer(data);
          return;
        }
      }
      // 如果上传不存在或已完成，清除待处理标记
      this.pendingBinaryUploadId = null;
    }

    // 如果没有找到对应的上传，作为普通二进制消息处理
    // 直接触发监听器，不通过 emit（避免 emit 检测到二进制数据后自动发送）
    const listeners = this.listeners.get("binary");
    if (listeners) {
      for (const listener of listeners) {
        listener(data);
      }
    }
  }

  /**
   * 处理文件分片元数据
   * @param metadata 分片元数据（包含uploadId）
   */
  private handleFileChunkMetadata(metadata: {
    uploadId: string; // 客户端生成的唯一上传ID
    fileName: string;
    fileSize: number;
    chunkIndex: number;
    totalChunks: number;
    chunkSize: number;
  }): void {
    const { uploadId } = metadata;

    // 如果是第一个分片，创建新的上传任务
    if (metadata.chunkIndex === 0) {
      this.fileUploads.set(uploadId, {
        fileName: metadata.fileName,
        fileSize: metadata.fileSize,
        totalChunks: metadata.totalChunks,
        chunks: new Map(),
        receivedChunks: 0,
        createdAt: Date.now(),
      });

      // 设置上传超时（30秒无新分片则清理）
      const timeout = setTimeout(() => {
        this.cleanupFileUpload(uploadId, "上传超时");
      }, 30000) as unknown as number;
      this.fileUploadTimers.set(uploadId, timeout);
    } else {
      // 如果不是第一个分片，重置超时定时器
      const existingTimeout = this.fileUploadTimers.get(uploadId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        const newTimeout = setTimeout(() => {
          this.cleanupFileUpload(uploadId, "上传超时");
        }, 30000) as unknown as number;
        this.fileUploadTimers.set(uploadId, newTimeout);
      }
    }

    // 设置待处理的二进制上传ID，用于关联下一个二进制消息
    this.pendingBinaryUploadId = uploadId;

    // 触发 file-chunk 事件，让用户代码可以处理
    this.emit("file-chunk", {
      ...metadata,
      uploadId, // 确保 uploadId 在最后，覆盖 metadata 中的 uploadId（如果存在）
    });
  }

  /**
   * 完成文件上传
   * @param uploadId 上传ID
   * @param upload 上传信息
   */
  private completeFileUpload(
    uploadId: string,
    upload: {
      fileName: string;
      fileSize: number;
      totalChunks: number;
      chunks: Map<number, Uint8Array>;
      receivedChunks: number;
    },
  ): void {
    // 清理超时定时器
    const timeout = this.fileUploadTimers.get(uploadId);
    if (timeout) {
      clearTimeout(timeout);
      this.fileUploadTimers.delete(uploadId);
    }

    // 按顺序组装所有分片
    const fileData = new Uint8Array(upload.fileSize);
    let offset = 0;

    for (let i = 0; i < upload.totalChunks; i++) {
      const chunk = upload.chunks.get(i);
      if (chunk) {
        fileData.set(chunk, offset);
        offset += chunk.length;
      } else {
        // 如果缺少分片，触发错误事件
        this.emit("file-upload-error", {
          uploadId,
          error: `缺少分片 ${i}`,
        });
        this.cleanupFileUpload(uploadId, "分片不完整");
        return;
      }
    }

    // 触发文件上传完成事件
    this.emit("file-upload", {
      uploadId,
      fileName: upload.fileName,
      fileSize: upload.fileSize,
      fileData: fileData.buffer, // 返回 ArrayBuffer
    });

    // 清理上传状态
    this.cleanupFileUpload(uploadId);
  }

  /**
   * 清理文件上传状态
   * @param uploadId 上传ID
   * @param reason 清理原因（可选）
   */
  private cleanupFileUpload(uploadId: string, reason?: string): void {
    // 清理超时定时器
    const timeout = this.fileUploadTimers.get(uploadId);
    if (timeout) {
      clearTimeout(timeout);
      this.fileUploadTimers.delete(uploadId);
    }

    // 清理上传状态
    this.fileUploads.delete(uploadId);

    // 如果当前待处理的上传ID是这个，清除它
    if (this.pendingBinaryUploadId === uploadId) {
      this.pendingBinaryUploadId = null;
    }

    // 如果有清理原因，触发错误事件
    if (reason) {
      this.emit("file-upload-error", {
        uploadId,
        error: reason,
      });
    }
  }

  /**
   * 处理事件
   * @param event 事件名称
   * @param data 事件数据
   * @param callbackId 回调 ID
   */
  private handleEvent(event: string, data: any, callbackId?: string): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        const callback = callbackId
          ? async (response: any) => {
            await this.sendMessage({
              type: "callback",
              callbackId,
              data: response,
            });
          }
          : undefined;
        try {
          listener(data, callback);
        } catch (error) {
          // 如果监听器抛出错误，发送错误回调（如果有回调ID）
          if (callbackId) {
            this.sendMessage({
              type: "callback",
              callbackId,
              data: {
                error: error instanceof Error ? error.message : String(error),
              },
            }).catch((err) => {
              // 忽略发送错误回调时的错误
              console.error("发送错误回调失败:", err);
            });
          }
          // 触发错误事件
          this.emit("error", error);
        }
      }
    }
  }

  /**
   * 设置心跳检测
   */
  private setupHeartbeat(): void {
    const pingInterval = this.server.options.pingInterval || 30000;
    const pingTimeout = this.server.options.pingTimeout || 60000;

    this.heartbeatManager = new HeartbeatManager(
      this,
      pingInterval,
      pingTimeout,
    );
    this.heartbeatManager.start();
  }

  /**
   * 设置关闭处理
   */
  private setupCloseHandler(): void {
    const closeHandler = () => {
      this.disconnect("client disconnect");
    };

    const errorHandler = (error: Event) => {
      this.emit("error", error);
    };

    if (this.ws && typeof (this.ws as any).addEventListener === "function") {
      (this.ws as any).addEventListener("close", closeHandler);
      (this.ws as any).addEventListener("error", errorHandler);
    } else if (this.ws) {
      (this.ws as any).onclose = closeHandler;
      (this.ws as any).onerror = errorHandler;
    }
  }

  /**
   * 发送消息（内部方法）
   * @param message 消息对象
   */
  async sendMessage(message: WebSocketMessage): Promise<void> {
    // 序列化消息（自动加密）
    const serialized = await serializeMessage(message, this.encryptionManager);
    this.sendRaw(serialized);
  }

  /**
   * 发送已序列化的消息（优化方法，用于批量发送）
   * @param serialized 已序列化的消息字符串
   */
  sendRaw(serialized: string): void {
    // 检查是否是 WebSocketAdapter（通过检查是否有 pendingOperations 属性）
    const isAdapter = typeof (this.ws as any).pendingOperations !== "undefined";

    if (isAdapter) {
      // 如果是 WebSocketAdapter（Bun 环境），允许 CONNECTING 状态
      if (
        this.ws.readyState === WebSocket.CONNECTING ||
        this.ws.readyState === WebSocket.OPEN
      ) {
        this.ws.send(serialized);
      }
    } else {
      // 如果是原生 WebSocket（Deno 环境），只在 OPEN 状态时发送
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(serialized);
      } else if (this.ws.readyState === WebSocket.CONNECTING) {
        // 如果连接还未打开，等待 open 事件后再发送
        const nativeWs = this.ws as WebSocket;
        const openHandler = () => {
          if (nativeWs.readyState === WebSocket.OPEN) {
            nativeWs.send(serialized);
          }
          if (typeof nativeWs.removeEventListener === "function") {
            nativeWs.removeEventListener("open", openHandler);
          }
        };
        nativeWs.addEventListener("open", openHandler);
      }
    }
  }

  /**
   * 监听事件
   * @param event 事件名称
   * @param listener 事件监听器
   */
  on(event: string, listener: SocketEventListener): void {
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
  off(event: string, listener?: SocketEventListener): void {
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

    // 发送 JSON 格式的事件消息（异步发送，不等待）
    this.sendMessage({
      type: "event",
      event,
      data,
      callbackId,
    }).catch((error) => {
      // 发送失败时触发错误事件
      this.emit("error", error);
    });
  }

  /**
   * 发送二进制消息
   * @param data 二进制数据（ArrayBuffer、Blob 或 Uint8Array）
   */
  sendBinary(data: ArrayBuffer | Blob | Uint8Array): void {
    // 检查是否是 WebSocketAdapter（通过检查是否有 pendingOperations 属性）
    const isAdapter = typeof (this.ws as any).pendingOperations !== "undefined";

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

    if (isAdapter) {
      // 如果是 WebSocketAdapter（Bun 环境），允许 CONNECTING 状态
      if (
        this.ws.readyState === WebSocket.CONNECTING ||
        this.ws.readyState === WebSocket.OPEN
      ) {
        this.ws.send(binaryData);
      }
    } else {
      // 如果是原生 WebSocket（Deno 环境），只在 OPEN 状态时发送
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(binaryData);
      } else if (this.ws.readyState === WebSocket.CONNECTING) {
        // 如果连接还未打开，等待 open 事件后再发送
        const nativeWs = this.ws as WebSocket;
        const openHandler = () => {
          if (nativeWs.readyState === WebSocket.OPEN) {
            nativeWs.send(binaryData);
          }
          if (typeof nativeWs.removeEventListener === "function") {
            nativeWs.removeEventListener("open", openHandler);
          }
        };
        nativeWs.addEventListener("open", openHandler);
      }
    }
  }

  /**
   * 加入房间
   * @param room 房间名称
   */
  join(room: string): void {
    if (!this.rooms.has(room)) {
      this.rooms.add(room);
      this.server.addSocketToRoom(this.id, room);
    }
  }

  /**
   * 批量加入房间
   * @param rooms 房间名称数组
   */
  joinRooms(rooms: string[]): void {
    for (const room of rooms) {
      this.join(room);
    }
  }

  /**
   * 离开房间
   * @param room 房间名称
   */
  leave(room: string): void {
    if (this.rooms.has(room)) {
      this.rooms.delete(room);
      this.server.removeSocketFromRoom(this.id, room);
    }
  }

  /**
   * 批量离开房间
   * @param rooms 房间名称数组
   */
  leaveRooms(rooms: string[]): void {
    for (const room of rooms) {
      this.leave(room);
    }
  }

  /**
   * 向房间发送消息（不包括自己）
   * @param room 房间名称
   */
  to(room: string): {
    emit: (
      event: string,
      data?: any,
      callback?: (response: any) => void,
    ) => void;
  } {
    return {
      emit: (event: string, data?: any, callback?: (response: any) => void) => {
        // 向房间发送消息，不支持回调（因为是多播）
        this.server.emitToRoom(room, event, data, this.id);
        // 如果有回调，在发送后立即调用（表示发送成功）
        if (callback) {
          callback({ success: true });
        }
      },
    };
  }

  /**
   * 向多个房间发送消息（不包括自己）
   * @param rooms 房间名称数组
   */
  toRooms(rooms: string[]): {
    emit: (event: string, data?: any) => void;
  } {
    return {
      emit: async (event: string, data?: any) => {
        // 并行向多个房间发送消息
        await Promise.all(
          rooms.map((room) =>
            this.server.emitToRoom(room, event, data, this.id)
          ),
        );
      },
    };
  }

  /**
   * 广播消息（不包括自己）
   */
  broadcast: {
    emit: (event: string, data?: any) => void;
  } = {
    emit: async (event: string, data?: any) => {
      await this.server.broadcast(event, data, this.id);
    },
  };

  /**
   * 断开连接
   * @param reason 断开原因
   */
  disconnect(reason?: string): void {
    if (!this.connected) return;

    this.connected = false;

    // 停止心跳检测
    this.heartbeatManager?.stop();

    // 清理所有文件上传状态（防止内存泄漏）
    for (const [uploadId] of this.fileUploads.entries()) {
      this.cleanupFileUpload(uploadId);
    }
    this.fileUploads.clear();
    this.fileUploadTimers.clear();
    this.pendingBinaryUploadId = null;

    // 离开所有房间
    for (const room of this.rooms) {
      this.server.removeSocketFromRoom(this.id, room);
    }
    this.rooms.clear();

    // 关闭 WebSocket
    // 在 Bun 环境下，即使 readyState 不是 OPEN，也应该尝试关闭
    // WebSocketAdapter 会处理 _ws 未设置的情况
    if (this.ws && typeof this.ws.close === "function") {
      try {
        // 无论 readyState 是什么，都尝试关闭
        // 这样可以确保在 Bun 环境下也能正确关闭连接
        this.ws.close(1000, reason || "Normal closure");
      } catch {
        // 如果关闭失败，忽略错误（可能已经关闭了）
      }
    }

    // 触发断开事件
    this.emit("disconnect", reason);

    // 从服务器移除（异步，但不等待）
    this.server.removeSocket(this.id).catch(() => {
      // 忽略错误
    });
  }
}
