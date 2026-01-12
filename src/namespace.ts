/**
 * @fileoverview 命名空间模块
 * 支持 WebSocket 命名空间，用于隔离不同业务场景
 */

import type { Server } from "./server.ts";
import type { Socket } from "./socket.ts";
import type { ServerEventListener, Middleware } from "./types.ts";

/**
 * 命名空间管理器
 * 管理多个命名空间，每个命名空间可以有独立的 Socket 连接和事件处理
 */
export class NamespaceManager {
  /** 命名空间映射（命名空间名称 -> 命名空间实例） */
  private namespaces: Map<string, Namespace> = new Map();
  /** 默认命名空间 */
  private defaultNamespace: Namespace;

  /**
   * 创建命名空间管理器
   * @param defaultNamespace 默认命名空间
   */
  constructor(defaultNamespace: Namespace) {
    this.defaultNamespace = defaultNamespace;
    this.namespaces.set("/", defaultNamespace);
  }

  /**
   * 获取或创建命名空间
   * @param name 命名空间名称（必须以 "/" 开头）
   * @returns 命名空间实例
   */
  of(name: string): Namespace {
    if (!name.startsWith("/")) {
      throw new Error("命名空间名称必须以 '/' 开头");
    }

    if (this.namespaces.has(name)) {
      return this.namespaces.get(name)!;
    }

    // 创建新命名空间
    const namespace = new Namespace(name);
    this.namespaces.set(name, namespace);
    return namespace;
  }

  /**
   * 获取默认命名空间
   * @returns 默认命名空间
   */
  getDefault(): Namespace {
    return this.defaultNamespace;
  }

  /**
   * 删除命名空间
   * @param name 命名空间名称
   */
  delete(name: string): void {
    if (name === "/") {
      throw new Error("不能删除默认命名空间");
    }
    this.namespaces.delete(name);
  }

  /**
   * 获取所有命名空间
   * @returns 命名空间名称数组
   */
  getAll(): string[] {
    return Array.from(this.namespaces.keys());
  }
}

/**
 * 命名空间类
 * 每个命名空间可以有独立的连接、事件和中间件
 */
export class Namespace {
  /** 命名空间名称 */
  public readonly name: string;
  /** Socket 连接池 */
  private sockets: Map<string, Socket> = new Map();
  /** 事件监听器 */
  private listeners: Map<string, ServerEventListener[]> = new Map();
  /** 中间件列表 */
  private middlewares: Middleware[] = [];
  /** 服务器实例 */
  private server: Server;

  /**
   * 创建命名空间
   * @param name 命名空间名称
   */
  constructor(name: string) {
    this.name = name;
    // 从 Server 实例中获取引用（需要 Server 传入）
    this.server = null as any; // 临时设置，需要在 Server 中设置
  }

  /**
   * 设置服务器实例
   * @param server 服务器实例
   */
  setServer(server: Server): void {
    this.server = server;
  }

  /**
   * 添加中间件
   * @param middleware 中间件函数
   */
  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  /**
   * 监听连接事件
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
   * 添加 Socket 到命名空间
   * @param socket Socket 实例
   */
  addSocket(socket: Socket): void {
    this.sockets.set(socket.id, socket);
  }

  /**
   * 从命名空间移除 Socket
   * @param socketId Socket ID
   */
  removeSocket(socketId: string): void {
    this.sockets.delete(socketId);
  }

  /**
   * 触发连接事件
   * @param socket Socket 实例
   */
  emitConnection(socket: Socket): void {
    const listeners = this.listeners.get("connection");
    if (listeners) {
      for (const listener of listeners) {
        listener(socket);
      }
    }
  }

  /**
   * 获取中间件列表
   * @returns 中间件列表
   */
  getMiddlewares(): Middleware[] {
    return this.middlewares;
  }

  /**
   * 获取 Socket 数量
   * @returns Socket 数量
   */
  getSocketCount(): number {
    return this.sockets.size;
  }

  /**
   * 获取所有 Socket
   * @returns Socket 数组
   */
  getSockets(): Socket[] {
    return Array.from(this.sockets.values());
  }
}
