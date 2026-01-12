/**
 * @fileoverview 消息加密模块
 * 提供消息加密和解密功能，支持客户端加密、服务端自动解密
 */

import { decrypt, encrypt } from "@dreamer/crypto";
import type { EncryptionConfig } from "./types.ts";

/**
 * 加密管理器
 * 负责消息的加密和解密
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

  /**
   * 创建加密管理器
   * @param config 加密配置
   */
  constructor(config: EncryptionConfig) {
    this.enabled = config.enabled !== false;

    // 处理密钥
    if (typeof config.key === "string") {
      // 字符串密钥：转换为 Uint8Array
      this.key = new TextEncoder().encode(config.key);
    } else {
      this.key = config.key;
    }

    // 确保密钥长度正确
    if (this.key.length !== 16 && this.key.length !== 32) {
      throw new Error(
        `密钥长度必须为 16 字节（AES-128）或 32 字节（AES-256），当前长度：${this.key.length}`,
      );
    }

    // 根据密钥长度确定算法
    if (!config.algorithm) {
      this.algorithm = this.key.length === 16 ? "aes-128-gcm" : "aes-256-gcm";
    } else {
      this.algorithm = config.algorithm;
      // 验证算法和密钥长度匹配
      const requiredLength = config.algorithm.includes("128") ? 16 : 32;
      if (this.key.length !== requiredLength) {
        throw new Error(
          `算法 ${config.algorithm} 需要 ${requiredLength} 字节密钥，当前密钥长度：${this.key.length}`,
        );
      }
    }
  }

  /**
   * 加密消息
   * @param plaintext 明文消息（JSON 字符串）
   * @returns 加密后的消息（Base64 编码）
   */
  async encryptMessage(plaintext: string): Promise<string> {
    if (!this.enabled) {
      return plaintext;
    }

    try {
      return await encrypt(plaintext, this.key, this.algorithm);
    } catch (error) {
      throw new Error(
        `加密失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 解密消息
   * @param ciphertext 加密消息（Base64 编码）
   * @returns 解密后的消息（JSON 字符串）
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
   * @param message 消息字符串
   * @returns 是否已加密
   */
  isEncrypted(message: string): boolean {
    // Base64 编码的加密消息通常以特定格式开始
    // 简单检查：尝试 Base64 解码，如果成功且长度合理，可能是加密消息
    try {
      // Base64 字符串通常只包含 A-Z, a-z, 0-9, +, /, = 字符
      const base64Pattern = /^[A-Za-z0-9+/]+=*$/;
      if (!base64Pattern.test(message)) {
        return false;
      }

      // 尝试解码
      const decoded = atob(message);
      // 加密消息通常包含 IV（12 或 16 字节）+ 加密数据
      // 最小长度应该大于 20 字节
      return decoded.length > 20;
    } catch {
      return false;
    }
  }

  /**
   * 生成随机密钥
   * @param algorithm 算法类型（用于确定密钥长度）
   * @returns 随机密钥
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
   * 从字符串生成密钥（使用 PBKDF2 或简单哈希）
   * @param password 密码字符串
   * @param algorithm 算法类型
   * @returns 密钥
   */
  static async deriveKeyFromPassword(
    password: string,
    algorithm: "aes-128" | "aes-256" = "aes-256",
  ): Promise<Uint8Array> {
    const keyLength = algorithm === "aes-128" ? 16 : 32;
    const encoder = new TextEncoder();
    const data = encoder.encode(password);

    // 使用 SHA-256 哈希生成密钥（简单方法）
    // 对于生产环境，建议使用 PBKDF2
    const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
    const hashArray = new Uint8Array(hashBuffer);

    // 如果密钥长度是 16，只取前 16 字节
    if (keyLength === 16) {
      return hashArray.slice(0, 16);
    }

    return hashArray;
  }
}
