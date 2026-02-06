/**
 * @fileoverview 消息序列化缓存模块
 * 缓存消息序列化结果，避免重复序列化相同消息
 */

import type { EncryptionManager } from "./encryption.ts";
import type { WebSocketMessage } from "./types.ts";
import { fnv1aHash } from "./hash.ts";
import { serializeMessage } from "./message.ts";

/**
 * 消息缓存项
 */
interface CachedMessage {
  /** 序列化后的消息 */
  serialized: string;
  /** 缓存时间戳 */
  timestamp: number;
  /** 使用次数 */
  useCount: number;
}

/**
 * 消息序列化缓存管理器
 * 用于优化大量连接场景下的消息序列化性能
 */
export class MessageCache {
  /** 缓存映射（消息哈希 -> 缓存项） */
  private cache: Map<string, CachedMessage> = new Map();
  /** 最大缓存大小 */
  private maxSize: number;
  /** 缓存过期时间（毫秒） */
  private ttl: number;
  /** 当前缓存大小 */
  private currentSize = 0;

  /**
   * 创建消息缓存管理器
   * @param maxSize 最大缓存项数量（默认：1000）
   * @param ttl 缓存过期时间（毫秒，默认：60000，即 1 分钟）
   */
  constructor(maxSize: number = 1000, ttl: number = 60000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  /**
   * 计算消息哈希
   * 使用 FNV-1a 快速哈希，比 JSON.stringify 更高效
   * @param message 消息对象
   * @param encryptionManager 加密管理器（用于区分加密/未加密）
   * @returns 消息哈希
   */
  private hashMessage(
    message: WebSocketMessage,
    encryptionManager?: EncryptionManager,
  ): string {
    const encryptionKey = encryptionManager ? "encrypted" : "plain";
    const str = `${encryptionKey}:${JSON.stringify(message)}`;
    return fnv1aHash(str);
  }

  /**
   * 序列化消息（带缓存）
   * @param message 消息对象
   * @param encryptionManager 加密管理器（可选）
   * @returns 序列化后的消息字符串
   */
  async serialize(
    message: WebSocketMessage,
    encryptionManager?: EncryptionManager,
  ): Promise<string> {
    const hash = this.hashMessage(message, encryptionManager);

    // 检查缓存
    const cached = this.cache.get(hash);
    if (cached) {
      // 检查是否过期
      if (Date.now() - cached.timestamp < this.ttl) {
        cached.useCount++;
        // LRU：访问后移到末尾（删除并重新插入，Map 保持插入顺序）
        this.cache.delete(hash);
        this.cache.set(hash, cached);
        return cached.serialized;
      } else {
        // 过期，删除
        this.cache.delete(hash);
        this.currentSize--;
      }
    }

    // 缓存未命中，序列化消息
    const serialized = await serializeMessage(message, encryptionManager);

    // 如果缓存已满，驱逐最久未使用的项（LRU，Map 首项为最久未使用，O(1)）
    if (this.currentSize >= this.maxSize) {
      this.evictLRU();
    }

    // 添加到缓存（新项在末尾）
    this.cache.set(hash, {
      serialized,
      timestamp: Date.now(),
      useCount: 1,
    });
    this.currentSize++;

    return serialized;
  }

  /**
   * 驱逐最久未使用的缓存项（LRU，O(1)）
   * 利用 Map 的插入顺序，首项为最久未访问
   */
  private evictLRU(): void {
    const firstKey = this.cache.keys().next().value;
    if (firstKey !== undefined) {
      this.cache.delete(firstKey);
      this.currentSize--;
    }
  }

  /**
   * 清理过期缓存
   */
  cleanup(): void {
    const now = Date.now();
    for (const [hash, cached] of this.cache.entries()) {
      if (now - cached.timestamp >= this.ttl) {
        this.cache.delete(hash);
        this.currentSize--;
      }
    }
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
  } {
    let totalUses = 0;
    for (const cached of this.cache.values()) {
      totalUses += cached.useCount;
    }

    return {
      size: this.currentSize,
      maxSize: this.maxSize,
      hitRate: this.currentSize > 0
        ? (totalUses - this.currentSize) / totalUses
        : 0,
    };
  }
}

/**
 * 全局消息缓存实例（可选使用）
 */
let globalMessageCache: MessageCache | null = null;

/**
 * 获取或创建全局消息缓存
 * @param maxSize 最大缓存大小
 * @param ttl 缓存过期时间
 * @returns 消息缓存实例
 */
export function getGlobalMessageCache(
  maxSize?: number,
  ttl?: number,
): MessageCache {
  if (!globalMessageCache) {
    globalMessageCache = new MessageCache(maxSize, ttl);
  }
  return globalMessageCache;
}

/**
 * 设置全局消息缓存
 * @param cache 消息缓存实例
 */
export function setGlobalMessageCache(cache: MessageCache | null): void {
  globalMessageCache = cache;
}
