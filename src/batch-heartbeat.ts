/**
 * @fileoverview 批量心跳管理器
 * 统一管理所有连接的心跳，减少定时器数量
 */

import type { Socket } from "./socket.ts";

/**
 * 批量心跳管理器
 * 统一管理多个 Socket 连接的心跳检测，减少定时器数量
 */
export class BatchHeartbeatManager {
  /** 需要心跳的 Socket 集合 */
  private sockets: Set<Socket> = new Set();
  /** 心跳间隔（毫秒） */
  private pingInterval: number;
  /** 心跳超时时间（毫秒） */
  private pingTimeout: number;
  /** 心跳定时器 */
  private pingTimer?: number;
  /** Socket 的最后心跳时间（Socket ID -> 时间戳） */
  private lastPingTime: Map<string, number> = new Map();
  /** 是否已启动 */
  private started = false;

  /**
   * 创建批量心跳管理器
   * @param pingInterval 心跳间隔（毫秒）
   * @param pingTimeout 心跳超时时间（毫秒）
   */
  constructor(pingInterval: number, pingTimeout: number) {
    this.pingInterval = pingInterval;
    this.pingTimeout = pingTimeout;
  }

  /**
   * 添加 Socket 到心跳管理
   * @param socket Socket 实例
   */
  add(socket: Socket): void {
    this.sockets.add(socket);
    this.lastPingTime.set(socket.id, Date.now());

    // 如果未启动，启动心跳
    if (!this.started) {
      this.start();
    }
  }

  /**
   * 从心跳管理移除 Socket
   * @param socket Socket 实例
   */
  remove(socket: Socket): void {
    this.sockets.delete(socket);
    this.lastPingTime.delete(socket.id);

    // 如果没有 Socket 了，停止心跳
    if (this.sockets.size === 0) {
      this.stop();
    }
  }

  /**
   * 启动心跳检测
   */
  private start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.sendPings();
  }

  /**
   * 停止心跳检测
   */
  stop(): void {
    this.started = false;
    if (this.pingTimer) {
      clearTimeout(this.pingTimer);
      this.pingTimer = undefined;
    }
  }

  /**
   * 批量发送心跳
   */
  private sendPings(): void {
    if (!this.started) {
      return;
    }

    const now = Date.now();
    const socketsToRemove: Socket[] = [];

    // 批量发送心跳并检查超时
    for (const socket of this.sockets) {
      if (!socket.connected) {
        socketsToRemove.push(socket);
        continue;
      }

      const lastPing = this.lastPingTime.get(socket.id) || now;
      const timeSinceLastPing = now - lastPing;

      // 检查是否超时
      if (timeSinceLastPing >= this.pingTimeout) {
        // 心跳超时，断开连接
        socket.disconnect("ping timeout");
        socketsToRemove.push(socket);
        continue;
      }

      // 发送心跳（异步，不等待）
      socket.sendMessage({ type: "ping" }).catch(() => {
        // 忽略发送失败的错误
      });

      // 更新最后心跳时间
      this.lastPingTime.set(socket.id, now);
    }

    // 移除已断开或超时的 Socket
    for (const socket of socketsToRemove) {
      this.remove(socket);
    }

    // 设置下一次心跳
    this.pingTimer = setTimeout(() => {
      this.sendPings();
    }, this.pingInterval) as unknown as number;
  }

  /**
   * 处理心跳响应（pong）
   * @param socket Socket 实例
   */
  handlePong(socket: Socket): void {
    // 更新最后心跳时间
    this.lastPingTime.set(socket.id, Date.now());
  }

  /**
   * 获取管理的 Socket 数量
   * @returns Socket 数量
   */
  getSocketCount(): number {
    return this.sockets.size;
  }

  /**
   * 清空所有 Socket
   */
  clear(): void {
    this.sockets.clear();
    this.lastPingTime.clear();
    this.stop();
  }
}
