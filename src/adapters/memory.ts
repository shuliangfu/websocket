/**
 * @fileoverview 内存适配器
 * 默认适配器，用于单服务器场景，不进行分布式通信
 */

import type { Socket } from "../socket.ts";
import type { MessageData, WebSocketAdapter } from "./types.ts";

/**
 * 内存适配器（默认，单服务器）
 * 不进行分布式通信，所有操作都在本地完成
 */
export class MemoryAdapter implements WebSocketAdapter {
  private serverId: string = "";
  private sockets: Map<string, Socket> = new Map();
  private rooms: Map<string, Set<string>> = new Map();
  private socketRooms: Map<string, Set<string>> = new Map();
  private keyPrefix: string = "ws";

  init(serverId: string, sockets: Map<string, Socket>): void {
    this.serverId = serverId;
    this.sockets = sockets;
  }

  close(): void {
    this.rooms.clear();
    this.socketRooms.clear();
  }

  addSocketToRoom(socketId: string, room: string): void {
    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }
    this.rooms.get(room)!.add(socketId);

    if (!this.socketRooms.has(socketId)) {
      this.socketRooms.set(socketId, new Set());
    }
    this.socketRooms.get(socketId)!.add(room);
  }

  removeSocketFromRoom(socketId: string, room: string): void {
    const roomSockets = this.rooms.get(room);
    if (roomSockets) {
      roomSockets.delete(socketId);
      if (roomSockets.size === 0) {
        this.rooms.delete(room);
      }
    }

    const socketRooms = this.socketRooms.get(socketId);
    if (socketRooms) {
      socketRooms.delete(room);
      if (socketRooms.size === 0) {
        this.socketRooms.delete(socketId);
      }
    }
  }

  removeSocketFromAllRooms(socketId: string): void {
    const rooms = this.socketRooms.get(socketId);
    if (rooms) {
      for (const room of rooms) {
        this.removeSocketFromRoom(socketId, room);
      }
    }
  }

  getSocketsInRoom(room: string): string[] {
    return Array.from(this.rooms.get(room) || []);
  }

  getRoomsForSocket(socketId: string): string[] {
    return Array.from(this.socketRooms.get(socketId) || []);
  }

  broadcast(_message: MessageData): void {
    // 内存适配器不需要跨服务器广播
  }

  broadcastToRoom(_room: string, _message: MessageData): void {
    // 内存适配器不需要跨服务器广播
  }

  subscribe(_callback: (message: MessageData, serverId: string) => void): void {
    // 内存适配器不需要订阅
  }

  unsubscribe(): void {
    // 内存适配器不需要取消订阅
  }

  getServerIds(): string[] {
    return [this.serverId];
  }

  registerServer(): void {
    // 内存适配器不需要注册
  }

  unregisterServer(): void {
    // 内存适配器不需要注销
  }
}
