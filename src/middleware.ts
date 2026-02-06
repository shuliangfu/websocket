/**
 * @fileoverview 中间件模块
 * 提供常用的 WebSocket 中间件
 */

import type { Logger } from "@dreamer/logger";
import { logger as defaultLogger } from "@dreamer/logger";
import type { Socket } from "./socket.ts";
import type { Middleware } from "./types.ts";

/**
 * 认证中间件工厂
 * 验证 WebSocket 连接的身份
 * @param validator 验证函数，返回 true 表示验证通过
 * @returns 中间件函数
 */
export function authMiddleware(
  validator: (socket: Socket) => boolean | Promise<boolean>,
): Middleware {
  return async (socket, next) => {
    try {
      const isValid = await validator(socket);
      if (isValid) {
        next();
      } else {
        next(
          new Error(
            socket.getServer()?.tr?.(
              "log.websocket.authFailed",
              "认证失败",
            ) ?? "认证失败",
          ),
        );
      }
    } catch (error) {
      next(
        error instanceof Error
          ? error
          : new Error(
            socket.getServer()?.tr?.(
              "log.websocket.authError",
              "认证错误",
            ) ?? "认证错误",
          ),
      );
    }
  };
}

/**
 * 日志中间件
 * 记录连接和消息日志
 * @param logger 日志器实例（可选，默认使用 @dreamer/logger 的默认 logger）
 * @returns 中间件函数
 */
export function loggerMiddleware(
  logger: Logger = defaultLogger,
): Middleware {
  return (socket, next) => {
    const msg = socket.getServer()?.tr?.(
      "log.websocket.connectionEstablished",
      `[WebSocket] 连接建立: ${socket.id} from ${socket.handshake.address || "unknown"}`,
      {
        socketId: socket.id,
        address: socket.handshake.address || "unknown",
      },
    ) ?? `[WebSocket] 连接建立: ${socket.id} from ${socket.handshake.address || "unknown"}`;
    logger.info(msg);
    next();
  };
}

/**
 * 限流中间件工厂
 * 限制连接数和消息频率
 * @param options 限流选项
 * @returns 中间件函数
 */
export function rateLimitMiddleware(options: {
  maxConnections?: number;
  maxMessagesPerSecond?: number;
}): Middleware {
  const connectionCounts = new Map<string, number>();
  const messageCounts = new Map<string, { count: number; resetAt: number }>();

  return (socket, next) => {
    const address = socket.handshake.address || "unknown";

    // 检查连接数限制
    if (options.maxConnections) {
      const currentConnections = connectionCounts.get(address) || 0;
      if (currentConnections >= options.maxConnections) {
        return next(
          new Error(
            socket.getServer()?.tr?.(
              "log.websocket.connectionLimitExceeded",
              "连接数超过限制",
            ) ?? "连接数超过限制",
          ),
        );
      }
      connectionCounts.set(address, currentConnections + 1);
    }

    // 检查消息频率限制
    if (options.maxMessagesPerSecond) {
      const now = Date.now();
      const messageInfo = messageCounts.get(socket.id);
      if (messageInfo && messageInfo.resetAt > now) {
        if (messageInfo.count >= options.maxMessagesPerSecond) {
          return next(
            new Error(
              socket.getServer()?.tr?.(
                "log.websocket.messageRateLimitExceeded",
                "消息频率超过限制",
              ) ?? "消息频率超过限制",
            ),
          );
        }
        messageInfo.count++;
      } else {
        messageCounts.set(socket.id, {
          count: 1,
          resetAt: now + 1000,
        });
      }
    }

    next();
  };
}

/**
 * CORS 中间件
 * 处理跨域请求
 * @param options CORS 选项
 * @returns 中间件函数
 */
export function corsMiddleware(options: {
  origin?: string | string[] | ((origin: string) => boolean);
}): Middleware {
  return (socket, next) => {
    const origin = socket.handshake.headers.get("origin");
    if (!origin) {
      return next();
    }

    if (typeof options.origin === "function") {
      if (options.origin(origin)) {
        next();
      } else {
        next(new Error("CORS 验证失败"));
      }
    } else if (Array.isArray(options.origin)) {
      if (options.origin.includes(origin)) {
        next();
      } else {
        next(new Error("CORS 验证失败"));
      }
    } else if (options.origin === "*" || options.origin === origin) {
      next();
    } else {
      next(new Error("CORS 验证失败"));
    }
  };
}
