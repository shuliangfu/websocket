/**
 * @fileoverview WebSocket 适配器类型定义
 * 定义适配器接口，支持多种后端（Redis、MongoDB 等）
 */

import type { Socket } from "../socket.ts";

/**
 * 适配器配置选项
 */
export interface AdapterOptions {
  /** 服务器 ID（用于标识当前服务器实例） */
  serverId?: string;
  /** 键前缀（用于区分不同的应用） */
  keyPrefix?: string;
}

/**
 * 房间信息
 */
export interface RoomInfo {
  /** 房间名称 */
  room: string;
  /** Socket ID 列表 */
  socketIds: string[];
}

/**
 * 消息数据
 */
export interface MessageData {
  /** 事件名称 */
  event: string;
  /** 事件数据 */
  data?: any;
  /** 房间名称（可选，用于房间广播） */
  room?: string;
  /** 排除的 Socket ID（可选） */
  excludeSocketId?: string;
  /** 命名空间（可选） */
  namespace?: string;
}

/**
 * WebSocket 适配器接口
 * 用于实现分布式 WebSocket 服务器
 */
export interface WebSocketAdapter {
  /**
   * 初始化适配器
   * @param serverId 服务器 ID
   * @param sockets 本地 Socket 映射
   */
  init(serverId: string, sockets: Map<string, Socket>): Promise<void> | void;

  /**
   * 关闭适配器
   */
  close(): Promise<void> | void;

  /**
   * 添加 Socket 到房间
   * @param socketId Socket ID
   * @param room 房间名称
   */
  addSocketToRoom(socketId: string, room: string): Promise<void> | void;

  /**
   * 从房间移除 Socket
   * @param socketId Socket ID
   * @param room 房间名称
   */
  removeSocketFromRoom(socketId: string, room: string): Promise<void> | void;

  /**
   * 从所有房间移除 Socket
   * @param socketId Socket ID
   */
  removeSocketFromAllRooms(socketId: string): Promise<void> | void;

  /**
   * 获取房间内的 Socket ID 列表
   * @param room 房间名称
   * @returns Socket ID 列表
   */
  getSocketsInRoom(room: string): Promise<string[]> | string[];

  /**
   * 获取 Socket 所在的房间列表
   * @param socketId Socket ID
   * @returns 房间名称列表
   */
  getRoomsForSocket(socketId: string): Promise<string[]> | string[];

  /**
   * 广播消息到所有服务器
   * @param message 消息数据
   */
  broadcast(message: MessageData): Promise<void> | void;

  /**
   * 向房间广播消息
   * @param room 房间名称
   * @param message 消息数据
   */
  broadcastToRoom(room: string, message: MessageData): Promise<void> | void;

  /**
   * 订阅消息（用于接收来自其他服务器的消息）
   * @param callback 消息回调函数
   */
  subscribe(
    callback: (message: MessageData, serverId: string) => void,
  ): Promise<void> | void;

  /**
   * 取消订阅
   */
  unsubscribe(): Promise<void> | void;

  /**
   * 获取所有服务器 ID
   * @returns 服务器 ID 列表
   */
  getServerIds(): Promise<string[]> | string[];

  /**
   * 注册服务器
   */
  registerServer(): Promise<void> | void;

  /**
   * 注销服务器
   */
  unregisterServer(): Promise<void> | void;
}
