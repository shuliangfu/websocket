/**
 * @fileoverview 测试工具函数
 * 提供测试中常用的工具函数
 */

/**
 * 获取可用端口
 */
export function getAvailablePort(): number {
  // 使用随机端口避免冲突
  return 30000 + Math.floor(Math.random() * 30000);
}

/**
 * 等待指定时间
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 创建 WebSocket 客户端连接
 */
export async function createWebSocketClient(
  url: string,
): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.onopen = () => resolve(ws);
    ws.onerror = (error) => reject(error);
    setTimeout(() => reject(new Error("连接超时")), 5000);
  });
}

/**
 * 等待 WebSocket 消息（使用 addEventListener，兼容 Bun）
 */
export function waitForMessage(
  ws: WebSocket,
  timeout = 5000,
): Promise<MessageEvent> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeEventListener("message", handler);
      ws.removeEventListener("error", errorHandler);
      reject(new Error("等待消息超时"));
    }, timeout);

    const handler = (event: MessageEvent) => {
      clearTimeout(timer);
      ws.removeEventListener("message", handler);
      ws.removeEventListener("error", errorHandler);
      resolve(event);
    };
    const errorHandler = (error: Event) => {
      clearTimeout(timer);
      ws.removeEventListener("message", handler);
      ws.removeEventListener("error", errorHandler);
      reject(error);
    };
    ws.addEventListener("message", handler);
    ws.addEventListener("error", errorHandler);
  });
}

/**
 * 等待 WebSocket 收到 type 为 "ping" 的 JSON 消息（用于批量心跳等）
 */
export function waitForPing(
  ws: WebSocket,
  timeout = 5000,
): Promise<{ type: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeEventListener("message", handler);
      ws.removeEventListener("error", errorHandler);
      reject(new Error("等待 ping 超时"));
    }, timeout);

    const handler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as { type?: string };
        if (data?.type === "ping") {
          clearTimeout(timer);
          ws.removeEventListener("message", handler);
          ws.removeEventListener("error", errorHandler);
          resolve({ type: data.type });
        }
      } catch {
        // 非 JSON，忽略
      }
    };
    const errorHandler = (err: Event) => {
      clearTimeout(timer);
      ws.removeEventListener("message", handler);
      ws.removeEventListener("error", errorHandler);
      reject(err);
    };
    ws.addEventListener("message", handler);
    ws.addEventListener("error", errorHandler);
  });
}

/**
 * 等待 WebSocket 收到指定事件（过滤 ping/pong 等）
 */
export function waitForEvent(
  ws: WebSocket,
  eventName: string,
  timeout = 5000,
): Promise<{ event: string; data?: unknown }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("等待事件超时")), timeout);
    const handler = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data as string);
        if (data.event === eventName) {
          clearTimeout(timer);
          ws.removeEventListener("message", handler as EventListener);
          resolve(data);
        }
      } catch {
        // 忽略解析错误
      }
    };
    ws.addEventListener("message", handler);
  });
}
