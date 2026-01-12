/**
 * @fileoverview 房间管理模块
 * 处理 WebSocket 房间的创建、加入、离开和消息广播
 */

import type { EncryptionManager } from "./encryption.ts";
import type { MessageCache } from "./message-cache.ts";
import type { Socket } from "./socket.ts";

/**
 * 房间管理器
 * 负责管理所有房间和 Socket 的房间关系
 */
export class RoomManager {
  /** 房间映射（房间名 -> Socket ID 集合） */
  private rooms: Map<string, Set<string>> = new Map();
  /** Socket 映射（Socket ID -> Socket 实例） */
  private sockets: Map<string, Socket> = new Map();

  /**
   * 添加 Socket 到房间
   * @param socketId Socket ID
   * @param room 房间名称
   */
  addSocketToRoom(socketId: string, room: string): void {
    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }
    this.rooms.get(room)!.add(socketId);
  }

  /**
   * 从房间移除 Socket
   * @param socketId Socket ID
   * @param room 房间名称
   */
  removeSocketFromRoom(socketId: string, room: string): void {
    const roomSockets = this.rooms.get(room);
    if (roomSockets) {
      roomSockets.delete(socketId);
      if (roomSockets.size === 0) {
        this.rooms.delete(room);
      }
    }
  }

  /**
   * 从所有房间移除 Socket
   * @param socketId Socket ID
   */
  removeSocketFromAllRooms(socketId: string): void {
    for (const [room, sockets] of this.rooms.entries()) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.rooms.delete(room);
      }
    }
  }

  /**
   * 向房间发送消息
   * @param room 房间名称
   * @param event 事件名称
   * @param data 事件数据
   * @param excludeSocketId 排除的 Socket ID
   * @param messageCache 消息缓存（可选，用于优化）
   * @param encryptionManager 加密管理器（可选）
   */
  async emitToRoom(
    room: string,
    event: string,
    data?: any,
    excludeSocketId?: string,
    messageCache?: MessageCache,
    encryptionManager?: EncryptionManager,
  ): Promise<void> {
    const roomSockets = this.rooms.get(room);
    if (!roomSockets) {
      return;
    }

    // 收集需要发送的 Socket
    const sockets: Socket[] = [];
    for (const socketId of roomSockets) {
      if (socketId !== excludeSocketId) {
        const socket = this.sockets.get(socketId);
        if (socket && (socket as any).connected) {
          sockets.push(socket);
        }
      }
    }

    if (sockets.length === 0) {
      return;
    }

    // 构建消息对象
    const message = {
      type: "event" as const,
      event,
      data,
    };

    // 如果 Socket 数较少，直接发送
    if (sockets.length <= 100) {
      // 对于少量连接，使用缓存优化：只序列化一次
      if (messageCache && sockets.length > 1) {
        const serialized = await messageCache.serialize(
          message,
          encryptionManager,
        );
        for (const socket of sockets) {
          socket.sendRaw(serialized);
        }
      } else {
        // 单个连接或未启用缓存，直接发送
        for (const socket of sockets) {
          socket.emit(event, data);
        }
      }
      return;
    }

    // 大量 Socket 时，使用异步分批发送
    // 动态计算批次大小：根据连接数调整，最小 50，最大 200
    const batchSize = Math.min(
      200,
      Math.max(50, Math.floor(sockets.length / 20)),
    );

    // 先序列化消息（使用缓存）
    const serialized = messageCache
      ? await messageCache.serialize(message, encryptionManager)
      : null;

    let index = 0;

    const sendBatch = () => {
      const end = Math.min(index + batchSize, sockets.length);
      for (let i = index; i < end; i++) {
        if (serialized) {
          // 使用已序列化的消息
          sockets[i].sendRaw(serialized);
        } else {
          // 未启用缓存，单独序列化
          sockets[i].emit(event, data);
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
   * 获取房间内的 Socket 数量
   * @param room 房间名称
   * @returns Socket 数量
   */
  getRoomSize(room: string): number {
    return this.rooms.get(room)?.size || 0;
  }

  /**
   * 获取房间列表
   * @returns 房间名称数组
   */
  getRooms(): string[] {
    return Array.from(this.rooms.keys());
  }

  /**
   * 检查房间是否存在
   * @param room 房间名称
   * @returns 是否存在
   */
  hasRoom(room: string): boolean {
    return this.rooms.has(room);
  }

  /**
   * 注册 Socket
   * @param socketId Socket ID
   * @param socket Socket 实例
   */
  registerSocket(socketId: string, socket: Socket): void {
    this.sockets.set(socketId, socket);
  }

  /**
   * 注销 Socket
   * @param socketId Socket ID
   */
  unregisterSocket(socketId: string): void {
    this.sockets.delete(socketId);
    this.removeSocketFromAllRooms(socketId);
  }

  /**
   * 清理所有房间
   */
  clear(): void {
    this.rooms.clear();
    this.sockets.clear();
  }
}
