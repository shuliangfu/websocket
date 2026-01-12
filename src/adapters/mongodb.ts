/**
 * @fileoverview MongoDB 分布式适配器
 * 使用 MongoDB 实现分布式 WebSocket 服务器
 *
 * 功能特性：
 * - 支持单节点 MongoDB（使用轮询方案）
 * - 支持单节点副本集 MongoDB（使用 Change Streams，性能更好）
 * - 支持多节点副本集 MongoDB（使用 Change Streams，实时性最好）
 * - 自动降级：如果 Change Streams 不可用，自动切换到轮询方案
 *
 * 连接配置示例：
 * ```typescript
 * // 单节点 MongoDB（无副本集）
 * { host: "127.0.0.1", port: 27017, database: "websocket_test" }
 *
 * // 单节点副本集（推荐，支持 Change Streams）
 * { host: "127.0.0.1", port: 27017, database: "websocket_test", replicaSet: "rs0" }
 *
 * // 多节点副本集
 * { url: "mongodb://host1:27017,host2:27017/websocket_test?replicaSet=rs0" }
 * ```
 *
 * 注意：
 * - MongoDB 不是理想的 Pub/Sub 解决方案，建议使用 Redis 适配器。
 * - 单节点模式下使用轮询（每 500ms 检查一次），延迟较高。
 * - 副本集模式下使用 Change Streams，实时性更好。
 * - 单节点副本集需要在 MongoDB 配置中启用副本集模式。
 */

import type { Socket } from "../socket.ts";
import type { AdapterOptions, MessageData, WebSocketAdapter } from "./types.ts";

// 静态导入 MongoDB 客户端（需要安装 mongodb 包：deno add npm:mongodb）
import { MongoClient } from "mongodb";

/**
 * MongoDB 连接配置
 */
export interface MongoDBConnectionConfig {
  /** MongoDB 连接 URL（例如：mongodb://127.0.0.1:27017） */
  url?: string;
  /** MongoDB 主机地址（默认：127.0.0.1） */
  host?: string;
  /** MongoDB 端口（默认：27017） */
  port?: number;
  /** 数据库名称 */
  database: string;
  /** 用户名（可选） */
  username?: string;
  /** 密码（可选） */
  password?: string;
  /** 副本集名称（可选，用于单节点副本集） */
  replicaSet?: string;
  /** 是否直接连接（默认：false，允许副本集连接） */
  directConnection?: boolean;
}

/**
 * MongoDB 适配器配置选项
 */
export interface MongoDBAdapterOptions extends AdapterOptions {
  /** MongoDB 连接配置 */
  connection: MongoDBConnectionConfig;
  /** 服务器心跳间隔（秒，默认：30） */
  heartbeatInterval?: number;
}

/**
 * MongoDB 客户端接口（兼容不同 MongoDB 客户端库）
 */
interface MongoDBClient {
  /** 数据库实例 */
  db(name: string): MongoDBDatabase;
  /** 连接方法 */
  connect?(): Promise<void>;
  /** 关闭连接 */
  close?(): Promise<void>;
}

/**
 * MongoDB 数据库接口
 */
interface MongoDBDatabase {
  /** 获取集合 */
  collection(name: string): MongoDBCollection;
}

/**
 * MongoDB 集合接口
 */
interface MongoDBCollection {
  /** 插入文档 */
  insertOne(doc: any): Promise<{ insertedId: string }>;
  /** 更新文档 */
  updateOne(filter: any, update: any, options?: any): Promise<any>;
  /** 删除文档 */
  deleteOne(filter: any): Promise<any>;
  /** 删除多个文档 */
  deleteMany(filter: any): Promise<any>;
  /** 查找文档 */
  find(filter?: any): MongoDBCursor;
  /** 查找一个文档 */
  findOne(filter?: any): Promise<any>;
  /** 创建索引 */
  createIndex?(keys: any, options?: any): Promise<string>;
  /** 监听变更流（Change Streams） */
  watch?(pipeline?: any[]): MongoDBChangeStream;
}

/**
 * MongoDB 游标接口
 */
interface MongoDBCursor {
  /** 转换为数组 */
  toArray(): Promise<any[]>;
}

/**
 * MongoDB 变更流接口
 */
interface MongoDBChangeStream {
  /** 监听变更事件 */
  on(event: string, callback: (change: any) => void): void;
  /** 关闭变更流 */
  close(): Promise<void>;
}

/**
 * MongoDB 分布式适配器
 * 使用 MongoDB 实现分布式 WebSocket 服务器
 *
 * 实现说明：
 * - 使用 MongoDB 集合存储房间和 Socket 关系
 * - 优先使用 Change Streams 监听消息变更（需要副本集模式）
 * - 如果 Change Streams 不可用，自动降级到轮询方案（支持单节点）
 * - 使用 TTL 索引自动清理过期数据
 *
 * 工作模式：
 * 1. 副本集模式：使用 Change Streams，实时监听消息变更（推荐，性能更好）
 * 2. 单节点模式：使用轮询，每 500ms 检查一次新消息（自动降级，延迟较高）
 */
export class MongoDBAdapter implements WebSocketAdapter {
  private serverId: string = "";
  private sockets: Map<string, Socket> = new Map();
  private connectionConfig: MongoDBConnectionConfig;
  private heartbeatInterval: number;
  private keyPrefix: string;
  private client: MongoDBClient | null = null;
  private db: MongoDBDatabase | null = null;
  private roomsCollection: MongoDBCollection | null = null;
  private messagesCollection: MongoDBCollection | null = null;
  private serversCollection: MongoDBCollection | null = null;
  private changeStream: MongoDBChangeStream | null = null;
  private messageCallback?: (message: MessageData, serverId: string) => void;
  private heartbeatTimer?: number;
  private internalClient: any = null;
  private pollingTimer?: number;
  private useChangeStreams: boolean = true;

  constructor(options: MongoDBAdapterOptions) {
    this.connectionConfig = options.connection;
    this.heartbeatInterval = options.heartbeatInterval || 30;
    this.keyPrefix = options.keyPrefix || "ws";
  }

  /**
   * 初始化适配器
   * @param serverId 服务器 ID
   * @param sockets Socket 映射
   */
  async init(serverId: string, sockets: Map<string, Socket>): Promise<void> {
    this.serverId = serverId;
    this.sockets = sockets;

    // 连接到 MongoDB
    await this.connectMongoDB();

    // 初始化集合
    await this.initializeCollections();

    // 注册服务器
    await this.registerServer();

    // 启动心跳
    this.startHeartbeat();

    // 订阅消息变更（可能是异步的）
    // 注意：这里传入的 callback 会被 subscribe 方法设置为 this.messageCallback
    // 但是，Server.listen 中会再次调用 subscribe，覆盖这个 callback
    // 所以这里传入一个占位 callback，只检查 serverId，不处理消息
    // 真正的消息处理由 Server.listen 中设置的 callback 完成
    const subscribeResult = this.subscribe((_message, fromServerId) => {
      // 忽略来自自己的消息
      if (fromServerId === this.serverId) {
        return;
      }

      // 注意：这里不应该调用 this.messageCallback，因为 this.messageCallback 就是当前的 callback
      // 如果调用会形成循环。真正的消息处理由 Server.listen 中设置的 callback 完成
      // 这个占位 callback 只是为了避免 Change Streams 初始化失败
    });
    if (subscribeResult instanceof Promise) {
      await subscribeResult;
    }
  }

  /**
   * 连接到 MongoDB
   */
  private async connectMongoDB(): Promise<void> {
    try {
      // 使用静态导入的 MongoClient
      const url = this.buildConnectionUrl();
      this.internalClient = new MongoClient(url);
      await this.internalClient.connect();
      this.client = this.internalClient as any;
      if (this.client) {
        this.db = this.client.db(this.connectionConfig.database);
      }
    } catch (error) {
      // 如果是模块未找到错误，提供清晰的提示
      if (
        error instanceof Error &&
        (error.message.includes("Cannot resolve") ||
          error.message.includes("not found") ||
          error.message.includes("Failed to resolve") ||
          error.message.includes("Cannot find module"))
      ) {
        throw new Error(
          "MongoDB 客户端未安装。请安装 mongodb 包：deno add npm:mongodb",
        );
      }

      // 如果是副本集相关错误，提供更详细的提示
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      if (
        errorMessage.includes("replica set") ||
        errorMessage.includes("replicaSet") ||
        errorMessage.includes("not a replica set") ||
        errorMessage.includes("No suitable servers found")
      ) {
        const url = this.buildConnectionUrl();
        throw new Error(
          `连接 MongoDB 失败（副本集相关）: ${errorMessage}\n` +
            `连接 URL: ${url.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")}\n` +
            `提示：如果使用单节点副本集，请在配置中添加 replicaSet 参数，例如：\n` +
            `{ host: "127.0.0.1", port: 27017, database: "xxx", replicaSet: "rs0" }`,
        );
      }

      throw new Error(
        `连接 MongoDB 失败: ${errorMessage}`,
      );
    }
  }

  /**
   * 构建连接 URL
   */
  private buildConnectionUrl(): string {
    const config = this.connectionConfig;
    if (config.url) {
      // 如果提供了完整 URL，检查是否需要添加副本集参数
      const url = new URL(config.url);
      const params = new URLSearchParams(url.search);

      // 如果配置了 replicaSet 但 URL 中没有，添加到 URL
      if (config.replicaSet && !params.has("replicaSet")) {
        params.set("replicaSet", config.replicaSet);
      }

      // 如果配置了 directConnection，添加到 URL
      if (
        config.directConnection !== undefined && !params.has("directConnection")
      ) {
        params.set("directConnection", String(config.directConnection));
      } else if (config.replicaSet && !params.has("directConnection")) {
        // 如果使用副本集，默认不直接连接（允许副本集连接）
        params.set("directConnection", "false");
      }

      url.search = params.toString();
      return url.toString();
    }

    const host = config.host || "127.0.0.1";
    const port = config.port || 27017;
    const database = config.database;

    // 构建查询参数
    const params = new URLSearchParams();
    if (config.replicaSet) {
      params.set("replicaSet", config.replicaSet);
      // 使用副本集时，默认不直接连接
      params.set("directConnection", "false");
    }
    if (config.directConnection !== undefined) {
      params.set("directConnection", String(config.directConnection));
    }

    const queryString = params.toString();
    const query = queryString ? `?${queryString}` : "";

    if (config.username && config.password) {
      return `mongodb://${config.username}:${config.password}@${host}:${port}/${database}${query}`;
    }

    return `mongodb://${host}:${port}/${database}${query}`;
  }

  /**
   * 初始化集合
   */
  private async initializeCollections(): Promise<void> {
    if (!this.db) {
      throw new Error("MongoDB 数据库未连接");
    }

    // 房间集合（存储房间和 Socket 的关系）- 使用 keyPrefix 隔离不同应用
    this.roomsCollection = this.db.collection(
      `${this.keyPrefix}_rooms`,
    );
    // 消息集合（存储待发送的消息）- 使用共享集合，所有服务器共享同一个消息集合
    // 注意：消息集合不使用 keyPrefix，以便所有服务器实例能够互相通信
    this.messagesCollection = this.db.collection("ws_messages");
    // 服务器集合（存储服务器注册信息）- 使用 keyPrefix 隔离不同应用
    this.serversCollection = this.db.collection(
      `${this.keyPrefix}_servers`,
    );

    // 创建 TTL 索引（自动清理过期数据）
    try {
      if (this.messagesCollection?.createIndex) {
        await this.messagesCollection.createIndex(
          { createdAt: 1 },
          { expireAfterSeconds: 60 },
        );
      }
      if (this.serversCollection?.createIndex) {
        await this.serversCollection.createIndex(
          { lastHeartbeat: 1 },
          { expireAfterSeconds: this.heartbeatInterval * 3 },
        );
      }
    } catch (error) {
      // 索引可能已存在，忽略错误
      console.warn("创建 MongoDB 索引失败（可能已存在）:", error);
    }
  }

  /**
   * 关闭适配器
   */
  async close(): Promise<void> {
    // 停止心跳
    this.stopHeartbeat();

    // 停止轮询
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = undefined;
    }

    // 关闭变更流
    if (this.changeStream) {
      await this.changeStream.close();
      this.changeStream = null;
    }

    // 注销服务器
    await this.unregisterServer();

    // 关闭连接
    if (this.internalClient && this.internalClient.close) {
      await this.internalClient.close();
      this.internalClient = null;
      this.client = null;
      this.db = null;
    }
  }

  /**
   * 添加 Socket 到房间
   * @param socketId Socket ID
   * @param room 房间名称
   */
  async addSocketToRoom(socketId: string, room: string): Promise<void> {
    if (!this.roomsCollection) {
      return;
    }

    const doc = {
      socketId,
      room,
      serverId: this.serverId,
      createdAt: new Date(),
    };

    // 使用 upsert 避免重复
    await this.roomsCollection.updateOne(
      { socketId, room },
      { $set: doc },
      { upsert: true },
    );
  }

  /**
   * 从房间移除 Socket
   * @param socketId Socket ID
   * @param room 房间名称
   */
  async removeSocketFromRoom(socketId: string, room: string): Promise<void> {
    if (!this.roomsCollection) {
      return;
    }

    await this.roomsCollection.deleteOne({ socketId, room });
  }

  /**
   * 从所有房间移除 Socket
   * @param socketId Socket ID
   */
  async removeSocketFromAllRooms(socketId: string): Promise<void> {
    if (!this.roomsCollection) {
      return;
    }

    await this.roomsCollection.deleteMany({ socketId });
  }

  /**
   * 获取房间内的 Socket ID 列表
   * @param room 房间名称
   * @returns Socket ID 列表
   */
  async getSocketsInRoom(room: string): Promise<string[]> {
    if (!this.roomsCollection) {
      return [];
    }

    const cursor = this.roomsCollection.find({ room });
    const docs = await cursor.toArray();
    return docs.map((doc) => doc.socketId);
  }

  /**
   * 获取 Socket 所在的房间列表
   * @param socketId Socket ID
   * @returns 房间名称列表
   */
  async getRoomsForSocket(socketId: string): Promise<string[]> {
    if (!this.roomsCollection) {
      return [];
    }

    const cursor = this.roomsCollection.find({ socketId });
    const docs = await cursor.toArray();
    return docs.map((doc) => doc.room);
  }

  /**
   * 广播消息到所有服务器
   * @param message 消息数据
   */
  async broadcast(message: MessageData): Promise<void> {
    if (!this.messagesCollection) {
      return;
    }

    // 将消息插入到消息集合
    await this.messagesCollection.insertOne({
      type: "broadcast",
      message,
      serverId: this.serverId,
      createdAt: new Date(),
    });
  }

  /**
   * 向房间广播消息
   * @param room 房间名称
   * @param message 消息数据
   */
  async broadcastToRoom(room: string, message: MessageData): Promise<void> {
    if (!this.messagesCollection) {
      return;
    }

    // 将消息插入到消息集合
    await this.messagesCollection.insertOne({
      type: "room",
      room,
      message,
      serverId: this.serverId,
      createdAt: new Date(),
    });
  }

  /**
   * 订阅消息（使用 Change Streams 或轮询降级方案）
   * @param callback 消息回调函数
   */
  subscribe(
    callback: (message: MessageData, serverId: string) => void,
  ): Promise<void> | void {
    if (!this.messagesCollection) {
      throw new Error("MongoDB 消息集合未初始化");
    }

    // 更新 messageCallback（支持多次调用，覆盖之前的 callback）
    this.messageCallback = callback;

    // 如果 Change Streams 已经启动，只需要更新 callback 即可
    if (this.changeStream && this.useChangeStreams) {
      // Change Streams 已经启动，callback 已经通过 this.messageCallback 更新
      // Change Streams 的事件处理器会使用最新的 this.messageCallback
      return Promise.resolve();
    }

    // 如果轮询已经启动，只需要更新 callback 即可
    if (this.pollingTimer && !this.useChangeStreams) {
      // 轮询已经启动，callback 已经通过 this.messageCallback 更新
      // 轮询会使用最新的 this.messageCallback
      return Promise.resolve();
    }

    // 尝试使用 Change Streams
    if (this.messagesCollection.watch) {
      try {
        // 监听消息集合的变更
        this.changeStream = this.messagesCollection.watch([
          {
            $match: {
              $or: [
                { "fullDocument.serverId": { $ne: this.serverId } },
                { "operationType": "insert" },
              ],
            },
          },
        ]);

        // 处理变更事件（使用 this.messageCallback，支持动态更新）
        this.changeStream.on("change", (change: any) => {
          try {
            if (change.operationType === "insert" && change.fullDocument) {
              const doc = change.fullDocument;
              if (doc.serverId === this.serverId) {
                // 忽略来自自己的消息
                return;
              }

              // 使用 this.messageCallback，支持动态更新
              if (!this.messageCallback) {
                return;
              }

              if (doc.type === "broadcast") {
                // 全局广播
                this.messageCallback(doc.message, doc.serverId);
              } else if (doc.type === "room") {
                // 房间广播
                this.messageCallback(
                  { ...doc.message, room: doc.room },
                  doc.serverId,
                );
              }
            }
          } catch (error) {
            console.error("处理 MongoDB 变更事件失败:", error);
          }
        });

        this.changeStream.on("error", (error: any) => {
          // 如果 Change Streams 失败（例如不是副本集），降级到轮询
          const errorMessage = error?.message || String(error);
          if (
            errorMessage.includes("replica set") ||
            errorMessage.includes("Change Streams") ||
            errorMessage.includes("replicaSet") ||
            errorMessage.includes("not a replica set")
          ) {
            console.warn(
              "MongoDB Change Streams 不可用（单节点模式），自动降级到轮询方案",
            );
            this.useChangeStreams = false;
            if (this.changeStream) {
              this.changeStream.close().catch(() => {});
              this.changeStream = null;
            }
            this.startPolling(callback);
          } else {
            console.error("MongoDB Change Streams 错误:", error);
          }
        });

        this.useChangeStreams = true;
        return Promise.resolve();
      } catch (error: any) {
        // Change Streams 初始化失败，降级到轮询
        const errorMessage = error?.message || String(error);
        if (
          errorMessage.includes("replica set") ||
          errorMessage.includes("Change Streams") ||
          errorMessage.includes("replicaSet") ||
          errorMessage.includes("not a replica set")
        ) {
          console.warn(
            "MongoDB Change Streams 不可用（单节点模式），自动降级到轮询方案",
          );
          this.useChangeStreams = false;
          this.startPolling(callback);
          return Promise.resolve();
        }
        throw error;
      }
    }

    // 如果没有 watch 方法，直接使用轮询
    this.useChangeStreams = false;
    this.startPolling(callback);
    return Promise.resolve();
  }

  /**
   * 启动轮询（降级方案）
   * @param _callback 消息回调函数（初始 callback，后续会通过 this.messageCallback 更新）
   */
  private startPolling(
    _callback: (message: MessageData, serverId: string) => void,
  ): void {
    if (!this.messagesCollection) {
      return;
    }

    let lastCheckTime = new Date(Date.now() - 2000); // 从2秒前开始检查，避免遗漏消息
    let processedIds = new Set<string>(); // 跟踪已处理的消息 ID

    // 立即执行一次轮询
    const pollOnce = async () => {
      try {
        const currentTime = new Date();
        // 查询所有未处理的消息（来自其他服务器）
        const messages = await this.messagesCollection!.find({
          serverId: { $ne: this.serverId },
          createdAt: { $gte: lastCheckTime },
        }).toArray();

        for (const doc of messages) {
          // 使用 _id 避免重复处理
          const docId = doc._id?.toString() ||
            `${doc.serverId}-${doc.createdAt}`;
          if (processedIds.has(docId)) {
            continue;
          }

          processedIds.add(docId);

          // 使用 this.messageCallback，支持动态更新（Server.listen 中会更新）
          if (!this.messageCallback) {
            continue;
          }

          if (doc.type === "broadcast") {
            // 全局广播
            this.messageCallback(doc.message, doc.serverId);
          } else if (doc.type === "room") {
            // 房间广播
            this.messageCallback(
              { ...doc.message, room: doc.room },
              doc.serverId,
            );
          }
        }

        // 更新最后检查时间
        lastCheckTime = currentTime;

        // 清理旧的已处理 ID（保留最近1000个）
        if (processedIds.size > 1000) {
          const idsArray = Array.from(processedIds);
          processedIds = new Set(idsArray.slice(-500));
        }
      } catch (error) {
        console.error("MongoDB 轮询错误:", error);
      }
    };

    // 立即执行一次
    pollOnce();

    // 每 500ms 轮询一次新消息
    this.pollingTimer = setInterval(pollOnce, 500) as unknown as number;
  }

  /**
   * 取消订阅
   */
  async unsubscribe(): Promise<void> {
    if (this.changeStream) {
      await this.changeStream.close();
      this.changeStream = null;
    }

    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = undefined;
    }

    this.messageCallback = undefined;
  }

  /**
   * 获取所有服务器 ID
   * @returns 服务器 ID 列表
   */
  async getServerIds(): Promise<string[]> {
    if (!this.serversCollection) {
      return [];
    }

    const cursor = this.serversCollection.find({});
    const docs = await cursor.toArray();
    return docs.map((doc) => doc.serverId);
  }

  /**
   * 注册服务器
   */
  async registerServer(): Promise<void> {
    if (!this.serversCollection) {
      return;
    }

    await this.serversCollection.updateOne(
      { serverId: this.serverId },
      {
        $set: {
          serverId: this.serverId,
          lastHeartbeat: new Date(),
        },
      },
      { upsert: true },
    );
  }

  /**
   * 注销服务器
   */
  async unregisterServer(): Promise<void> {
    if (!this.serversCollection) {
      return;
    }

    await this.serversCollection.deleteOne({ serverId: this.serverId });
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(async () => {
      await this.registerServer();
    }, this.heartbeatInterval * 1000) as unknown as number;
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }
}
