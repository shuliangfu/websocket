/**
 * @fileoverview WebSocket 测试
 */

import { describe, expect, it } from "jsr:@dreamer/test@^1.0.0-alpha.1";
import { Server } from "../src/mod.ts";

describe("WebSocket Server", () => {
  describe("Server", () => {
    it("应该创建服务器实例", () => {
      const server = new Server({
        port: 8080,
      });

      expect(server).toBeTruthy();
    });

    it("应该支持事件监听", () => {
      const server = new Server({ port: 8080 });
      let connected = false;

      server.on("connection", () => {
        connected = true;
      });

      expect(server).toBeTruthy();
    });
  });
});
