/**
 * @fileoverview 消息处理模块
 * 处理 WebSocket 消息的解析、序列化和二进制消息支持
 */

import type { EncryptionManager } from "./encryption.ts";
import type { WebSocketMessage } from "./types.ts";

/**
 * 解析 WebSocket 消息
 * @param data 消息数据（字符串、ArrayBuffer 或 Blob）
 * @param encryptionManager 加密管理器（可选，用于自动解密）
 * @returns 解析后的消息对象
 */
export async function parseMessage(
  data: string | ArrayBuffer | Blob,
  encryptionManager?: EncryptionManager,
): Promise<WebSocketMessage> {
  try {
    if (typeof data === "string") {
      // 文本消息：JSON 格式
      let jsonString = data;

      // 如果提供了加密管理器，尝试解密
      if (encryptionManager) {
        try {
          jsonString = await encryptionManager.decryptMessage(data);
        } catch (error) {
          // 如果解密失败，可能是未加密的消息，直接使用原始字符串
          // 或者检查是否是加密消息
          if (encryptionManager.isEncrypted(data)) {
            // 是加密消息但解密失败（可能是密钥不匹配）
            // 返回错误消息，但保留原始数据以便调试
            return {
              type: "error",
              data: `解密失败: ${
                error instanceof Error ? error.message : String(error)
              }`,
            };
          }
          // 不是加密消息，继续使用原始字符串
        }
      }

      // 尝试解析 JSON
      try {
        return JSON.parse(jsonString);
      } catch {
        // JSON 解析失败，可能是加密的 Base64 字符串（当没有加密管理器时）
        // 或者格式不正确的消息
        // 返回原始字符串作为事件数据，以便测试可以检查
        // 使用 "encrypted" 作为事件名，表示这是加密的消息
        return {
          type: "event",
          event: "encrypted",
          data: jsonString,
        };
      }
    } else if (data instanceof ArrayBuffer) {
      // 二进制消息：ArrayBuffer
      return {
        type: "binary",
        data: new Uint8Array(data),
      };
    } else if (data instanceof Blob) {
      // 二进制消息：Blob
      return {
        type: "binary",
        data: data,
      };
    } else {
      // 未知类型
      return {
        type: "error",
        data: data,
      };
    }
  } catch (error) {
    // JSON 解析失败
    return {
      type: "error",
      data: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 序列化消息为字符串
 * @param message 消息对象
 * @param encryptionManager 加密管理器（可选，用于自动加密）
 * @returns JSON 字符串（如果启用加密，返回加密后的 Base64 字符串）
 */
export async function serializeMessage(
  message: WebSocketMessage,
  encryptionManager?: EncryptionManager,
): Promise<string> {
  const jsonString = JSON.stringify(message);

  // 如果提供了加密管理器，加密消息
  if (encryptionManager) {
    return await encryptionManager.encryptMessage(jsonString);
  }

  return jsonString;
}

/**
 * 序列化消息为二进制
 * @param message 消息对象
 * @returns Uint8Array
 */
export function serializeMessageToBinary(
  message: WebSocketMessage,
): Uint8Array {
  const json = JSON.stringify(message);
  return new TextEncoder().encode(json);
}

/**
 * 检查消息是否为二进制类型
 * @param message 消息对象
 * @returns 是否为二进制消息
 */
export function isBinaryMessage(message: WebSocketMessage): boolean {
  return message.type === "binary";
}

/**
 * 检查消息是否为事件类型
 * @param message 消息对象
 * @returns 是否为事件消息
 */
export function isEventMessage(message: WebSocketMessage): boolean {
  return message.type === "event" && !!message.event;
}

/**
 * 检查消息是否为心跳消息
 * @param message 消息对象
 * @returns 是否为心跳消息
 */
export function isHeartbeatMessage(message: WebSocketMessage): boolean {
  return message.type === "ping" || message.type === "pong";
}

/**
 * 检查消息是否为回调消息
 * @param message 消息对象
 * @returns 是否为回调消息
 */
export function isCallbackMessage(message: WebSocketMessage): boolean {
  return message.type === "callback" && !!message.callbackId;
}
