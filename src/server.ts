/**
 * @fileoverview WebSocket 服务器类
 * 管理 WebSocket 服务器、连接、房间和事件
 */

import { createLogger, type Logger } from "@dreamer/logger";
import {
  serve,
  type ServeHandle,
  upgradeWebSocket,
} from "@dreamer/runtime-adapter";
import { EncryptionManager } from "./encryption.ts";
import { MessageCache } from "./message-cache.ts";
import { MessageQueue } from "./message-queue.ts";
import { Namespace, NamespaceManager } from "./namespace.ts";
import { RoomManager } from "./room.ts";
import { Socket } from "./socket.ts";
import type {
  Handshake,
  Middleware,
  ServerEventListener,
  ServerOptions,
} from "./types.ts";

/**
 * WebSocket 服务器类
 */
export class Server {
  /** 服务器配置 */
  public readonly options:
    & ServerOptions
    & Required<Pick<ServerOptions, "path" | "pingTimeout" | "pingInterval">>
    & {
      adapter?: import("./adapters/types.ts").WebSocketAdapter;
    };
  /** Socket 连接池 */
  private sockets: Map<string, Socket> = new Map();
  /** 适配器到 Socket 实例的映射（用于 Bun 环境） */
  private adapterToSocket: WeakMap<any, Socket> = new WeakMap();
  /** 房间管理器 */
  private roomManager: RoomManager;
  /** 命名空间管理器 */
  private namespaceManager: NamespaceManager;
  /** 事件监听器 */
  private listeners: Map<string, ServerEventListener[]> = new Map();
  /** 中间件列表 */
  private middlewares: Middleware[] = [];
  /** HTTP 服务器句柄 */
  private httpServer?: ServeHandle;
  /** 加密管理器（用于自动解密消息） */
  private encryptionManager?: EncryptionManager;
  /** 消息缓存（用于优化大量连接场景） */
  private messageCache?: MessageCache;
  /** 消息队列（用于缓冲和批量处理消息） */
  private messageQueue?: MessageQueue;
  /** 分布式适配器（用于多服务器实例） */
  private adapter?: import("./adapters/types.ts").WebSocketAdapter;
  /** 服务器 ID（用于分布式场景） */
  private serverId: string;
  /** Logger 实例（用于日志输出） */
  private readonly logger: Logger;

  /**
   * 调试日志：仅当 options.debug=true 时输出，使用 logger.debug（与 @dreamer/server 一致）
   */
  private debugLog(message: string): void {
    if (this.options.debug === true) {
      this.logger.debug(`[WebSocket] ${message}`);
    }
  }

  /**
   * 创建 WebSocket 服务器实例
   * @param options 服务器配置选项
   */
  constructor(options: ServerOptions = {}) {
    this.options = {
      path: options.path || "/",
      pingTimeout: options.pingTimeout || 60000,
      pingInterval: options.pingInterval || 30000,
      ...options,
    } as
      & ServerOptions
      & Required<Pick<ServerOptions, "path" | "pingTimeout" | "pingInterval">>;

    this.logger = this.options.logger ?? createLogger();

    // 初始化房间管理器
    this.roomManager = new RoomManager();

    // 初始化命名空间管理器（默认命名空间）
    const defaultNamespace = new Namespace("/");
    defaultNamespace.setServer(this);
    this.namespaceManager = new NamespaceManager(defaultNamespace);

    // 初始化加密管理器（如果配置了加密）
    if (this.options.encryption) {
      this.encryptionManager = new EncryptionManager(this.options.encryption);
    }

    // 初始化消息缓存（用于优化大量连接场景）
    // 默认缓存 1000 条消息，1 分钟过期
    this.messageCache = new MessageCache(1000, 60000);

    // 初始化消息队列（用于缓冲和批量处理消息）
    // 默认最大队列 10000 条，批次大小 100，处理间隔 10ms
    this.messageQueue = new MessageQueue(10000, 100, 10);

    // 初始化分布式适配器（默认使用内存适配器）
    // 注意：构造函数不能是 async，所以使用同步导入
    if (this.options.adapter) {
      this.adapter = this.options.adapter;
    } else {
      // 延迟初始化，在 listen 时完成
      this.adapter = undefined as any; // 临时赋值，稍后在 listen 中初始化
    }

    // 生成服务器 ID
    this.serverId = `server-${Date.now()}-${
      Math.random().toString(36).substring(2, 9)
    }`;

    // 初始化适配器（异步初始化在 listen 时完成）
    if (this.adapter?.init) {
      // 注意：init 可能是异步的，但构造函数不能是异步的
      // 实际的初始化会在 listen 时完成
      Promise.resolve(this.adapter.init(this.serverId, this.sockets)).catch(
        () => {
          // 忽略初始化错误
        },
      );
    }
  }

  /**
   * 添加中间件
   * @param middleware 中间件函数
   */
  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  /**
   * 监听事件
   * @param event 事件名称
   * @param listener 事件监听器
   */
  on(event: "connection", listener: ServerEventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  /**
   * 获取或创建命名空间
   * @param name 命名空间名称
   * @returns 命名空间实例
   */
  of(name: string): Namespace {
    return this.namespaceManager.of(name);
  }

  /**
   * 确保适配器已初始化（用于挂载模式，不调用 listen 时延迟初始化）
   */
  private async ensureAdapter(): Promise<void> {
    if (!this.adapter) {
      const { MemoryAdapter } = await import("./adapters/memory.ts");
      this.adapter = new MemoryAdapter();
    }
    if (this.adapter?.init) {
      const result = this.adapter.init(this.serverId, this.sockets);
      if (result instanceof Promise) {
        await result;
      }
    }
    if (this.adapter?.subscribe) {
      const subscribeResult = this.adapter.subscribe(
        (message, fromServerId) => {
          if (fromServerId === this.serverId) return;
          this.handleAdapterMessage(message, fromServerId);
        },
      );
      if (subscribeResult instanceof Promise) {
        await subscribeResult;
      }
    }
  }

  /**
   * 处理单个 HTTP 请求（挂载模式）
   *
   * 用于将 WebSocket 服务挂载到现有 HTTP 服务器（如 dweb 框架）。
   * 当请求路径匹配 options.path 且为 WebSocket 升级请求时，完成升级并返回响应。
   *
   * @param request 原始 HTTP 请求
   * @returns 响应（升级成功返回 101，否则返回 404/500）
   */
  async handleRequest(request: Request): Promise<Response> {
    await this.ensureAdapter();

    const url = new URL(request.url);
    const pathname = url.pathname;

    this.debugLog(`收到请求 path=${pathname} method=${request.method}`);

    let matchedNamespace: Namespace | null = null;
    const allNamespaces = this.namespaceManager.getAll();
    const sortedNamespaces = allNamespaces
      .map((name) => this.namespaceManager.of(name))
      .sort((a, b) => b.name.length - a.name.length);

    for (const namespace of sortedNamespaces) {
      if (namespace.name === "/") {
        if (pathname === this.options.path) {
          matchedNamespace = namespace;
          break;
        }
      } else {
        if (
          pathname === namespace.name ||
          pathname.startsWith(namespace.name + "/")
        ) {
          matchedNamespace = namespace;
          break;
        }
      }
    }

    if (!matchedNamespace) {
      this.debugLog(`路径不匹配 path=${pathname}，返回 404`);
      return new Response("Not Found", { status: 404 });
    }

    try {
      this.debugLog(`开始 WebSocket 升级 path=${pathname}`);
      const upgradeResult = upgradeWebSocket(request);
      const { socket, response } = upgradeResult;

      if (!socket || typeof socket !== "object") {
        throw new Error(`无效的 WebSocket 对象: ${typeof socket}`);
      }

      const hasAddEventListener =
        typeof (socket as any).addEventListener === "function";
      const hasOnMessage = typeof (socket as any).onmessage !== "undefined";

      if (!hasAddEventListener && !hasOnMessage) {
        const adapterKeys = Object.getOwnPropertyNames(socket);
        const prototypeKeys = Object.getOwnPropertyNames(
          Object.getPrototypeOf(socket || {}),
        );
        throw new Error(
          `WebSocket 对象缺少必要的方法。属性: ${
            adapterKeys.join(", ")
          }, 原型属性: ${prototypeKeys.join(", ")}`,
        );
      }

      const handshake: Handshake = {
        query: Object.fromEntries(url.searchParams as any),
        headers: request.headers,
        address: request.headers.get("x-forwarded-for") || undefined,
        url: request.url,
      };

      const socketInstance = new Socket(
        socket as any,
        this,
        handshake,
        this.encryptionManager,
      );

      this.adapterToSocket.set(socket, socketInstance);

      if (
        this.options.maxConnections &&
        this.sockets.size >= this.options.maxConnections
      ) {
        return new Response("Too Many Connections", { status: 503 });
      }

      this.roomManager.registerSocket(socketInstance.id, socketInstance);
      await this.executeMiddlewares(socketInstance);

      const namespaceMiddlewares = matchedNamespace.getMiddlewares();
      for (const middleware of namespaceMiddlewares) {
        await new Promise<void>((resolve, reject) => {
          const next = (error?: Error) => {
            if (error) reject(error);
            else resolve();
          };
          const result = middleware(socketInstance, next);
          if (result instanceof Promise) {
            result.catch(reject);
          }
        });
      }

      this.sockets.set(socketInstance.id, socketInstance);

      if (this.adapter?.init) {
        const result = this.adapter.init(this.serverId, this.sockets);
        if (result instanceof Promise) {
          result.catch(() => {});
        }
      }

      matchedNamespace.addSocket(socketInstance);
      this.emit("connection", socketInstance);
      matchedNamespace.emitConnection(socketInstance);

      this.debugLog(
        `WebSocket 升级成功 socketId=${socketInstance.id} path=${pathname}`,
      );
      return response || new Response("WebSocket upgrade", { status: 101 });
    } catch (err) {
      this.debugLog(
        `WebSocket 升级失败 path=${pathname}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return new Response("WebSocket upgrade failed", { status: 500 });
    }
  }

  /**
   * 启动服务器
   * @param host 主机地址（可选）
   * @param port 端口号（可选）
   */
  async listen(host?: string, port?: number): Promise<void> {
    await this.ensureAdapter();

    const serverHost = host || this.options.host || "0.0.0.0";
    const serverPort = port || this.options.port || 8080;

    this.httpServer = serve(
      {
        port: serverPort,
        host: serverHost === "0.0.0.0" ? undefined : serverHost,
      },
      (request: Request) => this.handleRequest(request),
    );
  }

  /**
   * 执行中间件
   * @param socket Socket 实例
   */
  private async executeMiddlewares(socket: Socket): Promise<void> {
    for (const middleware of this.middlewares) {
      await new Promise<void>((resolve, reject) => {
        const next = (error?: Error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        };
        const result = middleware(socket, next);
        if (result instanceof Promise) {
          result.catch(reject);
        }
      });
    }
  }

  /**
   * 触发事件
   * @param event 事件名称
   * @param socket Socket 实例
   */
  private emit(event: "connection", socket: Socket): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        listener(socket);
      }
    }
  }

  /**
   * 添加 Socket 到房间
   * @param socketId Socket ID
   * @param room 房间名称
   */
  async addSocketToRoom(socketId: string, room: string): Promise<void> {
    this.roomManager.addSocketToRoom(socketId, room);
    // 同步到适配器
    if (this.adapter?.addSocketToRoom) {
      await this.adapter.addSocketToRoom(socketId, room);
    }
  }

  /**
   * 从房间移除 Socket
   * @param socketId Socket ID
   * @param room 房间名称
   */
  async removeSocketFromRoom(socketId: string, room: string): Promise<void> {
    this.roomManager.removeSocketFromRoom(socketId, room);
    // 同步到适配器
    if (this.adapter?.removeSocketFromRoom) {
      await this.adapter.removeSocketFromRoom(socketId, room);
    }
  }

  /**
   * 向房间发送消息
   * @param room 房间名称
   * @param event 事件名称
   * @param data 事件数据
   * @param excludeSocketId 排除的 Socket ID
   */
  async emitToRoom(
    room: string,
    event: string,
    data?: any,
    excludeSocketId?: string,
  ): Promise<void> {
    // 先通过适配器广播到其他服务器的相同房间
    if (this.adapter?.broadcastToRoom) {
      await this.adapter.broadcastToRoom(room, {
        event,
        data,
        excludeSocketId,
      });
    }

    // 本地发送
    await this.roomManager.emitToRoom(
      room,
      event,
      data,
      excludeSocketId,
      this.messageCache,
      this.encryptionManager,
    );
  }

  /**
   * 广播消息
   * @param event 事件名称
   * @param data 事件数据
   * @param excludeSocketId 排除的 Socket ID
   */
  async broadcast(
    event: string,
    data?: any,
    excludeSocketId?: string,
  ): Promise<void> {
    // 使用异步队列避免阻塞事件循环
    // 对于大量连接，分批发送消息
    const sockets = Array.from(this.sockets.entries()).filter(
      ([socketId, socket]) => socketId !== excludeSocketId && socket.connected,
    );

    if (sockets.length === 0) {
      return;
    }

    // 构建消息对象
    const message = {
      type: "event" as const,
      event,
      data,
    };

    // 如果连接数较少，直接发送
    if (sockets.length <= 100) {
      // 对于少量连接，使用缓存优化：只序列化一次
      if (this.messageCache && sockets.length > 1) {
        const serialized = await this.messageCache.serialize(
          message,
          this.encryptionManager,
        );
        for (const [, socket] of sockets) {
          socket.sendRaw(serialized);
        }
      } else {
        // 单个连接或未启用缓存，直接发送
        for (const [, socket] of sockets) {
          socket.emit(event, data);
        }
      }
      return;
    }

    // 先通过适配器广播到其他服务器
    if (this.adapter?.broadcast) {
      await this.adapter.broadcast({
        event,
        data,
        excludeSocketId,
      });
    }

    // 大量连接时，使用异步分批发送
    // 动态计算批次大小：根据连接数调整，最小 50，最大 200
    const batchSize = Math.min(
      200,
      Math.max(50, Math.floor(sockets.length / 20)),
    );

    // 先序列化消息（使用缓存）
    const serialized = this.messageCache
      ? await this.messageCache.serialize(message, this.encryptionManager)
      : null;

    let index = 0;

    const sendBatch = () => {
      const end = Math.min(index + batchSize, sockets.length);
      for (let i = index; i < end; i++) {
        const [, socket] = sockets[i];
        if (serialized) {
          // 使用已序列化的消息
          socket.sendRaw(serialized);
        } else {
          // 未启用缓存，单独序列化
          socket.emit(event, data);
        }
      }
      index = end;

      if (index < sockets.length) {
        // 使用 queueMicrotask 或 setTimeout 让出事件循环
        if (typeof queueMicrotask === "function") {
          queueMicrotask(sendBatch);
        } else {
          setTimeout(sendBatch, 0);
        }
      }
    };

    sendBatch();
  }

  /**
   * 获取消息队列实例（用于高级用法）
   * @returns 消息队列实例
   */
  getMessageQueue(): MessageQueue | undefined {
    return this.messageQueue;
  }

  /**
   * 获取消息缓存实例（用于高级用法）
   * @returns 消息缓存实例
   */
  getMessageCache(): MessageCache | undefined {
    return this.messageCache;
  }

  /**
   * 获取服务器统计信息
   * @returns 统计信息
   */
  getStats(): {
    totalConnections: number;
    totalRooms: number;
    connectionsByRoom: Map<string, number>;
    messageQueue?: {
      size: number;
      maxSize: number;
      batchSize: number;
      processing: boolean;
    };
    messageCache?: {
      size: number;
      maxSize: number;
      hitRate: number;
    };
  } {
    const connectionsByRoom = new Map<string, number>();
    for (const room of this.roomManager.getRooms()) {
      connectionsByRoom.set(room, this.roomManager.getRoomSize(room));
    }

    return {
      totalConnections: this.sockets.size,
      totalRooms: this.roomManager.getRooms().length,
      connectionsByRoom,
    };
  }

  /**
   * 批量发送消息到指定 Socket
   * @param socketIds Socket ID 数组
   * @param event 事件名称
   * @param data 事件数据
   */
  batchEmit(socketIds: string[], event: string, data?: any): void {
    for (const socketId of socketIds) {
      const socket = this.sockets.get(socketId);
      if (socket && socket.connected) {
        socket.emit(event, data);
      }
    }
  }

  /**
   * 批量向多个房间发送消息
   * @param rooms 房间名称数组
   * @param event 事件名称
   * @param data 事件数据
   */
  batchEmitToRooms(rooms: string[], event: string, data?: any): void {
    for (const room of rooms) {
      this.emitToRoom(room, event, data);
    }
  }

  /**
   * 处理来自适配器的消息（来自其他服务器）
   * @param message 消息数据
   * @param _fromServerId 发送消息的服务器 ID
   */
  private async handleAdapterMessage(
    message: import("./adapters/types.ts").MessageData,
    _fromServerId: string,
  ): Promise<void> {
    // 如果是房间广播消息
    if (message.room && message.event) {
      // 向房间内的本地 Socket 发送消息（排除指定的 Socket）
      // 注意：这里直接调用 roomManager，不通过适配器，避免循环
      await this.roomManager.emitToRoom(
        message.room,
        message.event,
        message.data,
        message.excludeSocketId,
        this.messageCache,
        this.encryptionManager,
      );
    } else if (message.event) {
      // 全局广播消息
      // 注意：这里直接发送给本地 Socket，不通过适配器，避免循环
      const sockets = Array.from(this.sockets.entries()).filter(
        ([socketId, socket]) =>
          socketId !== message.excludeSocketId && socket.connected,
      );

      if (sockets.length === 0) {
        return;
      }

      // 构建消息对象
      const msg = {
        type: "event" as const,
        event: message.event,
        data: message.data,
      };

      // 使用缓存优化序列化
      if (this.messageCache && sockets.length > 1) {
        const serialized = await this.messageCache.serialize(
          msg,
          this.encryptionManager,
        );
        for (const [, socket] of sockets) {
          socket.sendRaw(serialized);
        }
      } else {
        // 单个连接或未启用缓存，直接发送
        for (const [, socket] of sockets) {
          socket.emit(message.event, message.data);
        }
      }
    }
  }

  /**
   * 移除 Socket
   * @param socketId Socket ID
   */
  async removeSocket(socketId: string): Promise<void> {
    // 从适配器中移除
    if (this.adapter?.removeSocketFromAllRooms) {
      await this.adapter.removeSocketFromAllRooms(socketId);
    }

    this.sockets.delete(socketId);
    this.roomManager.unregisterSocket(socketId);

    // 更新适配器的 Socket 映射
    if (this.adapter?.init) {
      this.adapter.init(this.serverId, this.sockets);
    }
  }

  /**
   * 关闭服务器
   */
  async close(): Promise<void> {
    // 关闭所有连接
    for (const socket of this.sockets.values()) {
      socket.disconnect("server shutdown");
    }

    // 关闭 HTTP 服务器，添加超时保护
    if (this.httpServer) {
      try {
        await Promise.race([
          this.httpServer.shutdown(),
          new Promise<void>((_, reject) => {
            setTimeout(() => reject(new Error("服务器关闭超时")), 2000);
          }),
        ]);
      } catch {
        // 如果超时，强制关闭
      }
    }
  }
}
