/**
 * @fileoverview 心跳检测模块
 * 处理 WebSocket 连接的心跳检测和超时管理
 */

import type { Socket } from "./socket.ts";

/**
 * 心跳管理器
 * 负责管理单个 Socket 连接的心跳检测
 */
export class HeartbeatManager {
  /** Socket 实例 */
  private socket: Socket;
  /** 心跳间隔（毫秒） */
  private pingInterval: number;
  /** 心跳超时时间（毫秒） */
  private pingTimeout: number;
  /** 心跳定时器 */
  private pingTimer?: number;
  /** 心跳超时定时器 */
  private pingTimeoutTimer?: number;
  /** 是否已启动 */
  private started = false;

  /**
   * 创建心跳管理器
   * @param socket Socket 实例
   * @param pingInterval 心跳间隔（毫秒）
   * @param pingTimeout 心跳超时时间（毫秒）
   */
  constructor(
    socket: Socket,
    pingInterval: number,
    pingTimeout: number,
  ) {
    this.socket = socket;
    this.pingInterval = pingInterval;
    this.pingTimeout = pingTimeout;
  }

  /**
   * 启动心跳检测
   */
  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.sendPing();
  }

  /**
   * 停止心跳检测
   */
  stop(): void {
    this.started = false;
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
   * 发送心跳
   */
  private sendPing(): void {
    if (!this.started) {
      return;
    }

    // 发送 ping 消息（异步发送，不等待）
    (this.socket as any).sendMessage({ type: "ping" }).catch(() => {
      // 忽略发送失败的错误
    });

    // 设置超时定时器
    this.pingTimeoutTimer = setTimeout(() => {
      if (this.started && (this.socket as any).connected) {
        // 心跳超时，断开连接
        (this.socket as any).disconnect("ping timeout");
      }
    }, this.pingTimeout) as unknown as number;

    // 设置下一次心跳
    this.pingTimer = setTimeout(() => {
      this.sendPing();
    }, this.pingInterval) as unknown as number;
  }

  /**
   * 处理心跳响应（pong）
   */
  handlePong(): void {
    if (this.pingTimeoutTimer) {
      clearTimeout(this.pingTimeoutTimer);
      this.pingTimeoutTimer = undefined;
    }
  }

  /**
   * 重置心跳定时器
   */
  reset(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
    this.sendPing();
  }
}
