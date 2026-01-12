/**
 * @fileoverview Redis 分布式适配器
 * 使用 Redis 实现分布式 WebSocket 服务器，支持多服务器实例之间的消息广播
 */

// Redis 客户端接口（与 @dreamer/cache 兼容）
export interface RedisClient {
  /** 设置键值 */
  set(
    key: string,
    value: string,
    options?: { EX?: number },
  ): Promise<void> | void;
  /** 获取值 */
  get(key: string): Promise<string | null> | string | null;
  /** 删除键 */
  del(key: string): Promise<number> | number;
  /** 检查键是否存在 */
  exists(key: string): Promise<number> | number;
  /** 获取所有匹配的键 */
  keys(pattern: string): Promise<string[]> | string[];
  /** 设置过期时间 */
  expire(key: string, seconds: number): Promise<number> | number;
  /** 断开连接 */
  disconnect?: () => Promise<void> | void;
  /** 退出连接 */
  quit?: () => Promise<void> | void;
}
import type { Socket } from "../socket.ts";
import type { AdapterOptions, MessageData, WebSocketAdapter } from "./types.ts";

/**
 * Redis 连接配置
 */
export interface RedisConnectionConfig {
  /** Redis 连接 URL（例如：redis://127.0.0.1:6379） */
  url?: string;
  /** Redis 主机地址（默认：127.0.0.1） */
  host?: string;
  /** Redis 端口（默认：6379） */
  port?: number;
  /** Redis 密码（可选） */
  password?: string;
  /** Redis 数据库编号（默认：0） */
  db?: number;
}

/**
 * Redis Pub/Sub 客户端接口
 */
export interface RedisPubSubClient {
  /** 发布消息 */
  publish(channel: string, message: string): Promise<number> | number;
  /** 订阅频道 */
  subscribe(
    channel: string,
    callback: (message: string) => void,
  ): Promise<void>;
  /** 取消订阅 */
  unsubscribe(channel: string): Promise<void>;
  /** 断开连接 */
  disconnect?: () => Promise<void> | void;
  /** 退出连接 */
  quit?: () => Promise<void> | void;
}

/**
 * Redis 适配器配置选项
 */
export interface RedisAdapterOptions extends AdapterOptions {
  /** Redis 连接配置（用于数据存储） */
  connection?: RedisConnectionConfig;
  /** Redis 客户端实例（用于数据存储） */
  client?: RedisClient;
  /** Redis Pub/Sub 连接配置（用于消息发布/订阅） */
  pubsubConnection?: RedisConnectionConfig;
  /** Redis Pub/Sub 客户端实例（用于消息发布/订阅） */
  pubsubClient?: RedisPubSubClient;
  /** 服务器心跳间隔（秒，默认：30） */
  heartbeatInterval?: number;
}

/**
 * Redis 分布式适配器
 * 使用 Redis 实现分布式 WebSocket 服务器
 */
export class RedisAdapter implements WebSocketAdapter {
  private serverId: string = "";
  private sockets: Map<string, Socket> = new Map();
  private client: RedisClient | null = null;
  private pubsubClient: RedisPubSubClient | null = null;
  private keyPrefix: string;
  private connectionConfig?: RedisConnectionConfig;
  private pubsubConnectionConfig?: RedisConnectionConfig;
  private heartbeatInterval: number;
  private heartbeatTimer?: number;
  private messageCallback?: (message: MessageData, serverId: string) => void;
  private internalClient: any = null;
  private internalPubsubClient: any = null;

  constructor(options: RedisAdapterOptions = {}) {
    this.keyPrefix = options.keyPrefix || "ws";
    this.heartbeatInterval = options.heartbeatInterval || 30;

    if (options.connection) {
      this.connectionConfig = options.connection;
    } else if (options.client) {
      this.client = options.client;
    } else {
      throw new Error(
        "RedisAdapter 需要提供 connection 配置或 client 实例",
      );
    }

    if (options.pubsubConnection) {
      this.pubsubConnectionConfig = options.pubsubConnection;
    } else if (options.pubsubClient) {
      this.pubsubClient = options.pubsubClient;
    } else {
      // 如果没有提供 Pub/Sub 配置，使用与 client 相同的配置
      this.pubsubConnectionConfig = this.connectionConfig;
    }
  }

  /**
   * 连接到 Redis
   */
  private async connectRedis(): Promise<void> {
    if (this.connectionConfig && !this.internalClient) {
      // 动态导入 Redis 客户端（根据运行时环境选择）
      try {
        // 尝试使用 redis（推荐）
        const { createClient } = await import("redis");
        this.internalClient = createClient({
          url: this.connectionConfig.url ||
            `redis://${this.connectionConfig.host || "127.0.0.1"}:${
              this.connectionConfig.port || 6379
            }`,
          password: this.connectionConfig.password,
          database: this.connectionConfig.db || 0,
        });
        await this.internalClient.connect();
        this.client = this.internalClient as any;
      } catch (error) {
        throw new Error(
          `无法创建 Redis 客户端: ${
            error instanceof Error ? error.message : String(error)
          }。请确保已安装 redis 包（npm install redis）`,
        );
      }
    }
  }

  /**
   * 连接到 Redis Pub/Sub
   * 注意：需要创建两个独立的客户端，一个用于订阅，一个用于发布
   * 因为在订阅模式下，客户端不能执行其他命令（如 publish）
   */
  private async connectPubSub(): Promise<void> {
    if (this.pubsubConnectionConfig && !this.internalPubsubClient) {
      try {
        const { createClient } = await import("redis");
        // 创建订阅客户端（用于接收消息）
        const subscribeClient = createClient({
          url: this.pubsubConnectionConfig.url ||
            `redis://${this.pubsubConnectionConfig.host || "127.0.0.1"}:${
              this.pubsubConnectionConfig.port || 6379
            }`,
          password: this.pubsubConnectionConfig.password,
          database: this.pubsubConnectionConfig.db || 0,
        });
        await subscribeClient.connect();

        // 创建发布客户端（用于发送消息）
        // 使用 duplicate() 方法创建副本，或者创建新客户端
        const publishClient = subscribeClient.duplicate
          ? subscribeClient.duplicate()
          : createClient({
            url: this.pubsubConnectionConfig.url ||
              `redis://${this.pubsubConnectionConfig.host || "127.0.0.1"}:${
                this.pubsubConnectionConfig.port || 6379
              }`,
            password: this.pubsubConnectionConfig.password,
            database: this.pubsubConnectionConfig.db || 0,
          });

        if (publishClient.connect) {
          await publishClient.connect();
        }

        // 订阅客户端用于订阅，发布客户端用于发布
        // 创建一个包装对象，将订阅和发布分开
        this.internalPubsubClient = {
          subscribeClient,
          publishClient,
        } as any;

        // 创建一个统一的接口
        this.pubsubClient = {
          subscribe: async (
            channel: string,
            callback: (payload: string) => void,
          ) => {
            await subscribeClient.subscribe(channel, callback);
          },
          unsubscribe: async (channel: string) => {
            await subscribeClient.unsubscribe(channel);
          },
          publish: async (channel: string, message: string) => {
            return await publishClient.publish(channel, message);
          },
          quit: async () => {
            await subscribeClient.quit();
            await publishClient.quit();
          },
          disconnect: async () => {
            await subscribeClient.disconnect();
            await publishClient.disconnect();
          },
        } as any;
      } catch (error) {
        throw new Error(
          `无法创建 Redis Pub/Sub 客户端: ${
            error instanceof Error ? error.message : String(error)
          }。请确保已安装 redis 包（npm install redis）`,
        );
      }
    }
  }

  /**
   * 获取完整键名
   */
  private getKey(key: string): string {
    return `${this.keyPrefix}:${key}`;
  }

  /**
   * 初始化适配器
   */
  async init(serverId: string, sockets: Map<string, Socket>): Promise<void> {
    this.serverId = serverId;
    this.sockets = sockets;

    // 连接到 Redis
    await this.connectRedis();
    await this.connectPubSub();

    // 注册服务器
    await this.registerServer();

    // 启动心跳
    this.startHeartbeat();

    // 订阅消息
    await this.subscribe((message, fromServerId) => {
      // 忽略来自自己的消息
      if (fromServerId === this.serverId) {
        return;
      }

      // 处理消息
      if (this.messageCallback) {
        this.messageCallback(message, fromServerId);
      }
    });
  }

  /**
   * 关闭适配器
   */
  async close(): Promise<void> {
    // 停止心跳
    this.stopHeartbeat();

    // 注销服务器
    await this.unregisterServer();

    // 取消订阅
    await this.unsubscribe();

    // 断开连接
    if (this.internalClient) {
      if (this.internalClient.quit) {
        await this.internalClient.quit();
      } else if (this.internalClient.disconnect) {
        await this.internalClient.disconnect();
      }
      this.internalClient = null;
      this.client = null;
    }

    if (this.internalPubsubClient) {
      if (this.internalPubsubClient.quit) {
        await this.internalPubsubClient.quit();
      } else if (this.internalPubsubClient.disconnect) {
        await this.internalPubsubClient.disconnect();
      }
      this.internalPubsubClient = null;
      this.pubsubClient = null;
    }
  }

  /**
   * 添加 Socket 到房间
   */
  async addSocketToRoom(socketId: string, room: string): Promise<void> {
    if (!this.client) {
      throw new Error("Redis 客户端未连接");
    }

    const roomKey = this.getKey(`room:${room}`);
    const socketKey = this.getKey(`socket:${socketId}:rooms`);

    // 使用 Redis SET 存储房间成员
    const addResult = this.client.set(
      `${roomKey}:${socketId}`,
      this.serverId,
      { EX: this.heartbeatInterval * 3 },
    );
    if (addResult instanceof Promise) {
      await addResult;
    }

    // 记录 Socket 所在的房间
    const socketRoomsResult = this.client.get(socketKey);
    const socketRooms = socketRoomsResult instanceof Promise
      ? await socketRoomsResult
      : socketRoomsResult;
    const rooms = socketRooms ? JSON.parse(socketRooms) : [];
    if (!rooms.includes(room)) {
      rooms.push(room);
      const setResult = this.client.set(
        socketKey,
        JSON.stringify(rooms),
        { EX: this.heartbeatInterval * 3 },
      );
      if (setResult instanceof Promise) {
        await setResult;
      }
    }
  }

  /**
   * 从房间移除 Socket
   */
  async removeSocketFromRoom(socketId: string, room: string): Promise<void> {
    if (!this.client) {
      return;
    }

    const roomKey = this.getKey(`room:${room}`);
    const socketKey = this.getKey(`socket:${socketId}:rooms`);

    // 删除房间成员
    const delResult = this.client.del(`${roomKey}:${socketId}`);
    if (delResult instanceof Promise) {
      await delResult;
    }

    // 更新 Socket 的房间列表
    const socketRoomsResult = this.client.get(socketKey);
    const socketRooms = socketRoomsResult instanceof Promise
      ? await socketRoomsResult
      : socketRoomsResult;
    if (socketRooms) {
      const rooms = JSON.parse(socketRooms);
      const index = rooms.indexOf(room);
      if (index > -1) {
        rooms.splice(index, 1);
        if (rooms.length === 0) {
          const delSocketKeyResult = this.client.del(socketKey);
          if (delSocketKeyResult instanceof Promise) {
            await delSocketKeyResult;
          }
        } else {
          const setResult = this.client.set(
            socketKey,
            JSON.stringify(rooms),
            { EX: this.heartbeatInterval * 3 },
          );
          if (setResult instanceof Promise) {
            await setResult;
          }
        }
      }
    }
  }

  /**
   * 从所有房间移除 Socket
   */
  async removeSocketFromAllRooms(socketId: string): Promise<void> {
    const rooms = await this.getRoomsForSocket(socketId);
    for (const room of rooms) {
      await this.removeSocketFromRoom(socketId, room);
    }
  }

  /**
   * 获取房间内的 Socket ID 列表
   */
  async getSocketsInRoom(room: string): Promise<string[]> {
    if (!this.client) {
      return [];
    }

    const roomKey = this.getKey(`room:${room}`);
    const keysResult = this.client.keys(`${roomKey}:*`);
    const keys = keysResult instanceof Promise ? await keysResult : keysResult;
    return keys.map((key) => key.split(":").pop() || "");
  }

  /**
   * 获取 Socket 所在的房间列表
   */
  async getRoomsForSocket(socketId: string): Promise<string[]> {
    if (!this.client) {
      return [];
    }

    const socketKey = this.getKey(`socket:${socketId}:rooms`);
    const socketRoomsResult = this.client.get(socketKey);
    const socketRooms = socketRoomsResult instanceof Promise
      ? await socketRoomsResult
      : socketRoomsResult;
    return socketRooms ? JSON.parse(socketRooms) : [];
  }

  /**
   * 广播消息到所有服务器
   */
  async broadcast(message: MessageData): Promise<void> {
    if (!this.pubsubClient) {
      return;
    }

    const channel = this.getKey("broadcast");
    const payload = JSON.stringify({
      serverId: this.serverId,
      message,
    });

    const publishResult = this.pubsubClient.publish(channel, payload);
    if (publishResult instanceof Promise) {
      await publishResult;
    }
  }

  /**
   * 向房间广播消息
   */
  async broadcastToRoom(room: string, message: MessageData): Promise<void> {
    if (!this.pubsubClient) {
      return;
    }

    const channel = this.getKey(`room:${room}`);
    const payload = JSON.stringify({
      serverId: this.serverId,
      message: { ...message, room },
    });

    const publishResult = this.pubsubClient.publish(channel, payload);
    if (publishResult instanceof Promise) {
      await publishResult;
    }
  }

  /**
   * 订阅消息
   */
  async subscribe(
    callback: (message: MessageData, serverId: string) => void,
  ): Promise<void> {
    if (!this.pubsubClient) {
      return;
    }

    this.messageCallback = callback;

    // 订阅广播频道
    const broadcastChannel = this.getKey("broadcast");
    await this.pubsubClient.subscribe(broadcastChannel, (payload: string) => {
      try {
        const data = JSON.parse(payload);
        if (data.serverId && data.message) {
          callback(data.message, data.serverId);
        }
      } catch (error) {
        console.error("解析 Redis 消息失败:", error);
      }
    });

    // 订阅房间频道（使用模式订阅）
    const roomPattern = this.getKey("room:*");
    await this.pubsubClient.subscribe(roomPattern, (payload: string) => {
      try {
        const data = JSON.parse(payload);
        if (data.serverId && data.message) {
          callback(data.message, data.serverId);
        }
      } catch (error) {
        console.error("解析 Redis 房间消息失败:", error);
      }
    });
  }

  /**
   * 取消订阅
   */
  async unsubscribe(): Promise<void> {
    if (!this.pubsubClient) {
      return;
    }

    const broadcastChannel = this.getKey("broadcast");
    const roomPattern = this.getKey("room:*");

    await this.pubsubClient.unsubscribe(broadcastChannel);
    await this.pubsubClient.unsubscribe(roomPattern);

    this.messageCallback = undefined;
  }

  /**
   * 获取所有服务器 ID
   */
  async getServerIds(): Promise<string[]> {
    if (!this.client) {
      return [];
    }

    const serverKey = this.getKey("servers");
    const keysResult = this.client.keys(`${serverKey}:*`);
    const keys = keysResult instanceof Promise ? await keysResult : keysResult;
    return keys.map((key) => key.split(":").pop() || "");
  }

  /**
   * 注册服务器
   */
  async registerServer(): Promise<void> {
    if (!this.client) {
      return;
    }

    const serverKey = this.getKey(`servers:${this.serverId}`);
    const setResult = this.client.set(
      serverKey,
      JSON.stringify({ serverId: this.serverId, timestamp: Date.now() }),
      { EX: this.heartbeatInterval * 3 },
    );
    if (setResult instanceof Promise) {
      await setResult;
    }
  }

  /**
   * 注销服务器
   */
  async unregisterServer(): Promise<void> {
    if (!this.client) {
      return;
    }

    const serverKey = this.getKey(`servers:${this.serverId}`);
    const delResult = this.client.del(serverKey);
    if (delResult instanceof Promise) {
      await delResult;
    }
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
