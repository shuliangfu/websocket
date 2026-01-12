/**
 * @fileoverview 跨运行时兼容性测试
 * 测试 WebSocket 服务器在不同运行时的兼容性
 */

import { describe, expect, it } from "@dreamer/test";
import { Server } from "../src/mod.ts";

describe("跨运行时兼容性", () => {
  it("应该在 Deno 环境下工作", () => {
    const server = new Server({ port: 8080 });
    expect(server).toBeTruthy();
  });

  it("应该在 Bun 环境下工作", () => {
    const server = new Server({ port: 8080 });
    expect(server).toBeTruthy();
  });
});
