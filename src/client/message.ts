/**
 * @fileoverview 客户端消息处理模块
 * 解析与序列化 WebSocket 消息，供 client 使用，不依赖服务端模块
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
  data: string | ArrayBuffer | Blob | Uint8Array,
  encryptionManager?: EncryptionManager,
): Promise<WebSocketMessage> {
  try {
    if (typeof data === "string") {
      let jsonString = data;

      if (encryptionManager) {
        try {
          jsonString = await encryptionManager.decryptMessage(data);
        } catch (error) {
          if (encryptionManager.isEncrypted(data)) {
            return {
              type: "error",
              data: `解密失败: ${
                error instanceof Error ? error.message : String(error)
              }`,
            };
          }
        }
      }

      try {
        return JSON.parse(jsonString) as WebSocketMessage;
      } catch {
        return {
          type: "event",
          event: "encrypted",
          data: jsonString,
        };
      }
    } else if (data instanceof Uint8Array) {
      return {
        type: "binary",
        data: new Uint8Array(data),
      };
    } else if (data instanceof ArrayBuffer) {
      return {
        type: "binary",
        data: new Uint8Array(data),
      };
    } else if (data instanceof Blob) {
      return {
        type: "binary",
        data: data,
      };
    } else {
      return {
        type: "error",
        data: data,
      };
    }
  } catch (error) {
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
 * @returns JSON 字符串或加密后的 Base64 字符串
 */
export async function serializeMessage(
  message: WebSocketMessage,
  encryptionManager?: EncryptionManager,
): Promise<string> {
  const jsonString = JSON.stringify(message);

  if (encryptionManager) {
    return await encryptionManager.encryptMessage(jsonString);
  }

  return jsonString;
}
