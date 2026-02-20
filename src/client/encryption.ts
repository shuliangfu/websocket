/**
 * @fileoverview 客户端消息加密模块
 * 提供消息加密和解密，仅依赖 @dreamer/crypto/client，供 client 打包使用
 */

import { decrypt, encrypt } from "@dreamer/crypto/client";
import type { EncryptionConfig } from "./types.ts";

/**
 * 加密缓存项
 */
interface EncryptionCacheItem {
  /** 加密后的消息 */
  encrypted: string;
  /** 缓存时间戳 */
  timestamp: number;
  /** 使用次数 */
  useCount: number;
}

/**
 * 客户端加密管理器
 * 负责消息的加密和解密，使用 @dreamer/crypto/client
 */
export class EncryptionManager {
  /** 加密密钥 */
  private key: Uint8Array;
  /** 加密算法 */
  private algorithm:
    | "aes-256-gcm"
    | "aes-128-gcm"
    | "aes-256-cbc"
    | "aes-128-cbc";
  /** 是否启用加密 */
  private enabled: boolean;
  /** 加密缓存（明文哈希 -> 加密结果） */
  private encryptionCache: Map<string, EncryptionCacheItem> = new Map();
  /** 最大缓存大小 */
  private maxCacheSize: number = 1000;
  /** 缓存过期时间（毫秒） */
  private cacheTTL: number = 60000;

  /**
   * 创建加密管理器
   * @param config 加密配置
   */
  constructor(config: EncryptionConfig) {
    this.enabled = config.enabled !== false;

    if (typeof config.key === "string") {
      this.key = new TextEncoder().encode(config.key);
    } else {
      this.key = config.key;
    }

    if (this.key.length !== 16 && this.key.length !== 32) {
      throw new Error(
        `密钥长度必须为 16 字节（AES-128）或 32 字节（AES-256），当前长度：${this.key.length}`,
      );
    }

    if (!config.algorithm) {
      this.algorithm = this.key.length === 16 ? "aes-128-gcm" : "aes-256-gcm";
    } else {
      this.algorithm = config.algorithm;
      const requiredLength = config.algorithm.includes("128") ? 16 : 32;
      if (this.key.length !== requiredLength) {
        throw new Error(
          `算法 ${config.algorithm} 需要 ${requiredLength} 字节密钥，当前密钥长度：${this.key.length}`,
        );
      }
    }

    if (config.cacheSize !== undefined) {
      this.maxCacheSize = config.cacheSize;
    }
    if (config.cacheTTL !== undefined) {
      this.cacheTTL = config.cacheTTL;
    }
  }

  /**
   * 计算明文哈希（用于缓存键）
   */
  private hashPlaintext(plaintext: string): string {
    return `${this.algorithm}:${plaintext.length}:${plaintext.slice(0, 100)}`;
  }

  /**
   * 加密消息（带缓存）
   */
  async encryptMessage(plaintext: string): Promise<string> {
    if (!this.enabled) {
      return plaintext;
    }

    const cacheKey = this.hashPlaintext(plaintext);
    const cached = this.encryptionCache.get(cacheKey);
    if (cached) {
      if (Date.now() - cached.timestamp < this.cacheTTL) {
        cached.useCount++;
        return cached.encrypted;
      }
      this.encryptionCache.delete(cacheKey);
    }

    try {
      const encrypted = await encrypt(plaintext, this.key, this.algorithm);

      if (this.encryptionCache.size >= this.maxCacheSize) {
        this.evictLeastUsed();
      }

      this.encryptionCache.set(cacheKey, {
        encrypted,
        timestamp: Date.now(),
        useCount: 1,
      });

      return encrypted;
    } catch (error) {
      throw new Error(
        `加密失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private evictLeastUsed(): void {
    let leastUsed: { key: string; useCount: number } | null = null;

    for (const [key, cached] of this.encryptionCache.entries()) {
      if (!leastUsed || cached.useCount < leastUsed.useCount) {
        leastUsed = { key, useCount: cached.useCount };
      }
    }

    if (leastUsed) {
      this.encryptionCache.delete(leastUsed.key);
    }
  }

  /** 清理过期缓存 */
  cleanupCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.encryptionCache.entries()) {
      if (now - cached.timestamp >= this.cacheTTL) {
        this.encryptionCache.delete(key);
      }
    }
  }

  /** 清空加密缓存 */
  clearCache(): void {
    this.encryptionCache.clear();
  }

  /**
   * 解密消息
   */
  async decryptMessage(ciphertext: string): Promise<string> {
    if (!this.enabled) {
      return ciphertext;
    }

    try {
      return await decrypt(ciphertext, this.key, this.algorithm);
    } catch (error) {
      throw new Error(
        `解密失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 检查消息是否已加密
   */
  isEncrypted(message: string): boolean {
    try {
      const base64Pattern = /^[A-Za-z0-9+/]+=*$/;
      if (!base64Pattern.test(message)) {
        return false;
      }
      const decoded = atob(message);
      return decoded.length > 20;
    } catch {
      return false;
    }
  }

  /**
   * 生成随机密钥
   */
  static generateKey(
    algorithm: "aes-128" | "aes-256" = "aes-256",
  ): Uint8Array {
    const keyLength = algorithm === "aes-128" ? 16 : 32;
    const key = new Uint8Array(keyLength);
    globalThis.crypto.getRandomValues(key);
    return key;
  }

  /**
   * 从字符串生成密钥（SHA-256 哈希）
   */
  static async deriveKeyFromPassword(
    password: string,
    algorithm: "aes-128" | "aes-256" = "aes-256",
  ): Promise<Uint8Array> {
    const keyLength = algorithm === "aes-128" ? 16 : 32;
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
    const hashArray = new Uint8Array(hashBuffer);
    if (keyLength === 16) {
      return hashArray.slice(0, 16);
    }
    return hashArray;
  }
}
