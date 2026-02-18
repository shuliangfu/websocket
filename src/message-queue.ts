/**
 * @fileoverview 消息队列模块
 * 用于缓冲和批量处理消息，优化大量连接场景下的性能
 */

import { $t } from "./i18n.ts";
import type { Socket } from "./socket.ts";

/**
 * 队列消息项
 */
interface QueueItem {
  /** Socket 实例 */
  socket: Socket;
  /** 事件名称 */
  event: string;
  /** 事件数据 */
  data?: any;
  /** 优先级（数字越小优先级越高，默认：0） */
  priority?: number;
}

/**
 * 错误回调类型（用于统一错误处理）
 */
export type MessageQueueErrorHandler = (
  message: string,
  error: unknown,
) => void;

/**
 * 消息队列管理器
 * 用于缓冲和批量处理消息，避免阻塞事件循环
 */
export class MessageQueue {
  /** 消息队列 */
  private queue: QueueItem[] = [];
  /** 最大队列大小 */
  private maxSize: number;
  /** 批次大小 */
  private batchSize: number;
  /** 是否正在处理 */
  private processing = false;
  /** 处理间隔（毫秒） */
  private processInterval: number;
  /** 错误处理器（可选，用于替代 console.error） */
  private onError?: MessageQueueErrorHandler;

  /**
   * 创建消息队列管理器
   * @param maxSize 最大队列大小（默认：10000）
   * @param batchSize 批次大小（默认：100）
   * @param processInterval 处理间隔（毫秒，默认：10）
   * @param onError 错误处理器（可选，用于通过 logger 等记录错误）
   */
  constructor(
    maxSize: number = 10000,
    batchSize: number = 100,
    processInterval: number = 10,
    onError?: MessageQueueErrorHandler,
  ) {
    this.maxSize = maxSize;
    this.batchSize = batchSize;
    this.processInterval = processInterval;
    this.onError = onError;
  }

  /**
   * 添加消息到队列
   * @param socket Socket 实例
   * @param event 事件名称
   * @param data 事件数据
   * @param priority 优先级（可选）
   * @returns 是否成功添加
   */
  enqueue(
    socket: Socket,
    event: string,
    data?: any,
    priority?: number,
  ): boolean {
    // 如果队列已满，丢弃最旧的消息（FIFO）
    if (this.queue.length >= this.maxSize) {
      this.queue.shift();
    }

    // 添加消息到队列
    this.queue.push({
      socket,
      event,
      data,
      priority: priority ?? 0,
    });

    // 如果未在处理，启动处理
    if (!this.processing) {
      this.process();
    }

    return true;
  }

  /**
   * 批量添加消息到队列
   * @param items 消息项数组
   * @returns 成功添加的数量
   */
  enqueueBatch(items: QueueItem[]): number {
    let added = 0;

    for (const item of items) {
      if (this.queue.length >= this.maxSize) {
        this.queue.shift();
      }

      this.queue.push({
        ...item,
        priority: item.priority ?? 0,
      });
      added++;
    }

    // 如果未在处理，启动处理
    if (!this.processing) {
      this.process();
    }

    return added;
  }

  /**
   * 处理队列中的消息
   * 按优先级处理，同优先级保持 FIFO，避免每次全量排序
   */
  private async process(): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      // 按优先级分桶，仅在有不同优先级时排序，否则保持 FIFO
      const hasMultiplePriorities = this.queue.some(
        (a, i) => i > 0 && (a.priority ?? 0) !== (this.queue[0].priority ?? 0),
      );
      if (hasMultiplePriorities) {
        this.queue.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
      }

      // 取出一批消息
      const batch = this.queue.splice(0, this.batchSize);

      // 批量发送消息
      for (const item of batch) {
        try {
          // 检查 Socket 是否仍连接
          if (item.socket.connected) {
            await item.socket.emit(item.event, item.data);
          }
        } catch (error) {
          // 忽略发送失败的错误（Socket 可能已断开），通过 onError 或 console 记录
          const server = item.socket.getServer();
          const errMsg = error instanceof Error ? error.message : String(error);
          const msg = $t(
            "log.websocket.messageSendFailed",
            { error: errMsg },
            server?.options?.lang,
          );
          if (this.onError) {
            this.onError(msg, error);
          } else {
            console.error(msg, error);
          }
        }
      }

      // 如果还有消息，等待一段时间再处理（让出事件循环）
      if (this.queue.length > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.processInterval)
        );
      }
    }

    this.processing = false;
  }

  /**
   * 清空队列
   */
  clear(): void {
    this.queue = [];
    this.processing = false;
  }

  /**
   * 获取队列大小
   * @returns 队列中的消息数量
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * 检查队列是否为空
   * @returns 是否为空
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * 获取队列统计信息
   */
  getStats(): {
    size: number;
    maxSize: number;
    batchSize: number;
    processing: boolean;
  } {
    return {
      size: this.queue.length,
      maxSize: this.maxSize,
      batchSize: this.batchSize,
      processing: this.processing,
    };
  }
}
