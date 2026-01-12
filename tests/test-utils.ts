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
 * 等待 WebSocket 消息
 */
export function waitForMessage(
  ws: WebSocket,
  timeout = 5000,
): Promise<MessageEvent> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("等待消息超时"));
    }, timeout);

    ws.onmessage = (event) => {
      clearTimeout(timer);
      resolve(event);
    };

    ws.onerror = (error) => {
      clearTimeout(timer);
      reject(error);
    };
  });
}
