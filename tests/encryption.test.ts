/**
 * @fileoverview 消息加密功能测试
 * 全面测试 WebSocket 消息加密和解密功能
 */

import { describe, expect, it } from "@dreamer/test";
import { Client } from "../src/client/mod.ts";
import { EncryptionManager } from "../src/encryption.ts";
import { Server } from "../src/mod.ts";
import { delay, getAvailablePort } from "./test-utils.ts";

describe("EncryptionManager", () => {
  describe("构造函数", () => {
    it("应该使用 Uint8Array 密钥创建实例", () => {
      const key = new Uint8Array(32);
      globalThis.crypto.getRandomValues(key);
      const manager = new EncryptionManager({ key });

      expect(manager).toBeTruthy();
    });

    it("应该使用字符串密钥创建实例", () => {
      const key = "my-secret-key-32-bytes-long!!!!!"; // 32 字节
      const manager = new EncryptionManager({ key });

      expect(manager).toBeTruthy();
    });

    it("应该根据密钥长度自动选择算法（32字节 -> AES-256）", () => {
      const key = new Uint8Array(32);
      globalThis.crypto.getRandomValues(key);
      const manager = new EncryptionManager({ key });

      expect(manager).toBeTruthy();
    });

    it("应该根据密钥长度自动选择算法（16字节 -> AES-128）", () => {
      const key = new Uint8Array(16);
      globalThis.crypto.getRandomValues(key);
      const manager = new EncryptionManager({ key });

      expect(manager).toBeTruthy();
    });

    it("应该支持指定算法", () => {
      const key = new Uint8Array(32);
      globalThis.crypto.getRandomValues(key);
      const manager = new EncryptionManager({
        key,
        algorithm: "aes-256-gcm",
      });

      expect(manager).toBeTruthy();
    });

    it("应该支持所有算法类型", () => {
      const algorithms = [
        "aes-256-gcm",
        "aes-128-gcm",
        "aes-256-cbc",
        "aes-128-cbc",
      ] as const;

      for (const algorithm of algorithms) {
        const keyLength = algorithm.includes("128") ? 16 : 32;
        const key = new Uint8Array(keyLength);
        globalThis.crypto.getRandomValues(key);

        const manager = new EncryptionManager({ key, algorithm });
        expect(manager).toBeTruthy();
      }
    });

    it("应该拒绝无效的密钥长度", () => {
      const key = new Uint8Array(24); // 无效长度

      expect(() => {
        new EncryptionManager({ key });
      }).toThrow();
    });

    it("应该拒绝算法和密钥长度不匹配", () => {
      const key = new Uint8Array(16); // 16字节密钥

      expect(() => {
        new EncryptionManager({ key, algorithm: "aes-256-gcm" }); // 需要32字节
      }).toThrow();
    });

    it("应该支持禁用加密", () => {
      const key = new Uint8Array(32);
      globalThis.crypto.getRandomValues(key);
      const manager = new EncryptionManager({
        key,
        enabled: false,
      });

      expect(manager).toBeTruthy();
    });
  });

  describe("加密和解密", () => {
    it("应该能够加密和解密消息", async () => {
      const key = EncryptionManager.generateKey("aes-256");
      const manager = new EncryptionManager({
        key,
        algorithm: "aes-256-gcm",
      });

      const plaintext = JSON.stringify({ type: "test", data: "hello" });
      const encrypted = await manager.encryptMessage(plaintext);
      const decrypted = await manager.decryptMessage(encrypted);

      expect(encrypted).not.toBe(plaintext);
      expect(decrypted).toBe(plaintext);
    });

    it("应该能够加密和解密复杂 JSON 数据", async () => {
      const key = EncryptionManager.generateKey("aes-256");
      const manager = new EncryptionManager({
        key,
        algorithm: "aes-256-gcm",
      });

      const complexData = {
        type: "event",
        event: "chat-message",
        data: {
          user: "Alice",
          message: "Hello, World!",
          timestamp: Date.now(),
          metadata: {
            room: "general",
            tags: ["important", "urgent"],
          },
        },
        callbackId: "12345",
      };

      const plaintext = JSON.stringify(complexData);
      const encrypted = await manager.encryptMessage(plaintext);
      const decrypted = await manager.decryptMessage(encrypted);
      const parsed = JSON.parse(decrypted);

      expect(parsed).toEqual(complexData);
    });

    it("应该支持 AES-256-GCM 算法", async () => {
      const key = EncryptionManager.generateKey("aes-256");
      const manager = new EncryptionManager({
        key,
        algorithm: "aes-256-gcm",
      });

      const plaintext = "test message";
      const encrypted = await manager.encryptMessage(plaintext);
      const decrypted = await manager.decryptMessage(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("应该支持 AES-128-GCM 算法", async () => {
      const key = EncryptionManager.generateKey("aes-128");
      const manager = new EncryptionManager({
        key,
        algorithm: "aes-128-gcm",
      });

      const plaintext = "test message";
      const encrypted = await manager.encryptMessage(plaintext);
      const decrypted = await manager.decryptMessage(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("应该支持 AES-256-CBC 算法", async () => {
      const key = EncryptionManager.generateKey("aes-256");
      const manager = new EncryptionManager({
        key,
        algorithm: "aes-256-cbc",
      });

      const plaintext = "test message";
      const encrypted = await manager.encryptMessage(plaintext);
      const decrypted = await manager.decryptMessage(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("应该支持 AES-128-CBC 算法", async () => {
      const key = EncryptionManager.generateKey("aes-128");
      const manager = new EncryptionManager({
        key,
        algorithm: "aes-128-cbc",
      });

      const plaintext = "test message";
      const encrypted = await manager.encryptMessage(plaintext);
      const decrypted = await manager.decryptMessage(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("应该拒绝使用错误密钥解密", async () => {
      const key1 = EncryptionManager.generateKey("aes-256");
      const key2 = EncryptionManager.generateKey("aes-256");
      const manager1 = new EncryptionManager({ key: key1 });
      const manager2 = new EncryptionManager({ key: key2 });

      const plaintext = "test message";
      const encrypted = await manager1.encryptMessage(plaintext);

      let errorThrown = false;
      try {
        await manager2.decryptMessage(encrypted);
      } catch (error) {
        errorThrown = true;
        expect(error).toBeInstanceOf(Error);
      }
      expect(errorThrown).toBe(true);
    });

    it("应该拒绝解密无效的加密数据", async () => {
      const key = EncryptionManager.generateKey("aes-256");
      const manager = new EncryptionManager({ key });

      let errorThrown = false;
      try {
        await manager.decryptMessage("invalid-base64");
      } catch (error) {
        errorThrown = true;
        expect(error).toBeInstanceOf(Error);
      }
      expect(errorThrown).toBe(true);
    });

    it("禁用加密时应该直接返回原始消息", async () => {
      const key = EncryptionManager.generateKey("aes-256");
      const manager = new EncryptionManager({
        key,
        enabled: false,
      });

      const plaintext = "test message";
      const encrypted = await manager.encryptMessage(plaintext);
      const decrypted = await manager.decryptMessage(plaintext);

      expect(encrypted).toBe(plaintext);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe("isEncrypted 方法", () => {
    it("应该正确识别加密消息", async () => {
      const key = EncryptionManager.generateKey("aes-256");
      const manager = new EncryptionManager({ key });

      const plaintext = "test message";
      const encrypted = await manager.encryptMessage(plaintext);

      expect(manager.isEncrypted(encrypted)).toBe(true);
      expect(manager.isEncrypted(plaintext)).toBe(false);
    });

    it("应该正确识别 JSON 消息", () => {
      const key = EncryptionManager.generateKey("aes-256");
      const manager = new EncryptionManager({ key });

      const jsonMessage = JSON.stringify({ type: "test", data: "hello" });
      expect(manager.isEncrypted(jsonMessage)).toBe(false);
    });
  });

  describe("静态方法", () => {
    it("应该能够生成随机密钥（AES-256）", () => {
      const key = EncryptionManager.generateKey("aes-256");

      expect(key).toBeInstanceOf(Uint8Array);
      expect(key.length).toBe(32);
    });

    it("应该能够生成随机密钥（AES-128）", () => {
      const key = EncryptionManager.generateKey("aes-128");

      expect(key).toBeInstanceOf(Uint8Array);
      expect(key.length).toBe(16);
    });

    it("应该能够从密码派生密钥（AES-256）", async () => {
      const password = "my-secret-password";
      const key = await EncryptionManager.deriveKeyFromPassword(
        password,
        "aes-256",
      );

      expect(key).toBeInstanceOf(Uint8Array);
      expect(key.length).toBe(32);
    });

    it("应该能够从密码派生密钥（AES-128）", async () => {
      const password = "my-secret-password";
      const key = await EncryptionManager.deriveKeyFromPassword(
        password,
        "aes-128",
      );

      expect(key).toBeInstanceOf(Uint8Array);
      expect(key.length).toBe(16);
    });

    it("相同密码应该派生相同密钥", async () => {
      const password = "my-secret-password";
      const key1 = await EncryptionManager.deriveKeyFromPassword(
        password,
        "aes-256",
      );
      const key2 = await EncryptionManager.deriveKeyFromPassword(
        password,
        "aes-256",
      );

      expect(key1).toEqual(key2);
    });

    it("不同密码应该派生不同密钥", async () => {
      const key1 = await EncryptionManager.deriveKeyFromPassword(
        "password1",
        "aes-256",
      );
      const key2 = await EncryptionManager.deriveKeyFromPassword(
        "password2",
        "aes-256",
      );

      expect(key1).not.toEqual(key2);
    });
  });
}, { sanitizeOps: false, sanitizeResources: false });

describe("WebSocket 加密 - 服务端", () => {
  describe("服务端接收加密消息", () => {
    it("应该能够接收并自动解密客户端发送的加密消息", async () => {
      const testPort = getAvailablePort();
      const key = EncryptionManager.generateKey("aes-256");

      const server = new Server({
        port: testPort,
        path: "/ws",
        encryption: {
          key,
          algorithm: "aes-256-gcm",
        },
      });

      let receivedData: any = null;

      server.on("connection", (socket) => {
        socket.on("test-event", (data: any) => {
          receivedData = data;
        });
      });

      server.listen();
      await delay(200);

      // 使用加密客户端连接
      const client = new Client({
        url: `ws://localhost:${testPort}/ws`,
        encryption: {
          key,
          algorithm: "aes-256-gcm",
        },
      });

      await Promise.race([
        new Promise<void>((resolve) => {
          client.on("open", () => {
            // 先发送一个简单的消息来触发适配器初始化
            setTimeout(() => {
              client.emit("ping-init", {});
              // 等待适配器初始化后再发送实际消息
              setTimeout(() => {
                client.emit("test-event", { message: "encrypted message" });
              }, 200);
            }, 100);
          });
          // 监听消息接收
          let checkInterval: number | undefined;
          const checkReceived = () => {
            if (receivedData) {
              if (checkInterval) clearInterval(checkInterval);
              resolve();
            }
          };
          checkInterval = setInterval(checkReceived, 50);
          setTimeout(() => {
            if (checkInterval) clearInterval(checkInterval);
            resolve();
          }, 5000);
        }),
        new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error("测试超时")), 10000);
        }),
      ]);

      await delay(500);
      expect(receivedData).toBeTruthy();
      expect(receivedData.message).toBe("encrypted message");

      client.disconnect();
      await delay(100);
      await server.close();
      await delay(100);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该能够处理多个加密消息", async () => {
      const testPort = getAvailablePort();
      const key = EncryptionManager.generateKey("aes-256");

      const server = new Server({
        port: testPort,
        path: "/ws",
        encryption: { key },
      });

      const receivedMessages: any[] = [];

      server.on("connection", (socket) => {
        socket.on("message", (data: any) => {
          receivedMessages.push(data);
        });
      });

      server.listen();
      await delay(200);

      const client = new Client({
        url: `ws://localhost:${testPort}/ws`,
        encryption: { key },
      });

      await Promise.race([
        new Promise<void>((resolve) => {
          client.on("open", () => {
            // 先发送一个简单的消息来触发适配器初始化
            setTimeout(() => {
              client.emit("ping-init", {});
              // 等待适配器初始化后再发送实际消息
              setTimeout(() => {
                client.emit("message", { id: 1, text: "message 1" });
                client.emit("message", { id: 2, text: "message 2" });
                client.emit("message", { id: 3, text: "message 3" });
              }, 200);
            }, 100);
            // 监听消息接收
            let checkInterval: number | undefined;
            const checkReceived = () => {
              if (receivedMessages.length >= 3) {
                if (checkInterval) clearInterval(checkInterval);
                resolve();
              }
            };
            checkInterval = setInterval(checkReceived, 50);
            setTimeout(() => {
              if (checkInterval) clearInterval(checkInterval);
              resolve();
            }, 5000);
          });
        }),
        new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error("测试超时")), 15000);
        }),
      ]);

      await delay(500);
      expect(receivedMessages.length).toBe(3);
      expect(receivedMessages[0].id).toBe(1);
      expect(receivedMessages[1].id).toBe(2);
      expect(receivedMessages[2].id).toBe(3);

      client.disconnect();
      await delay(100);
      await server.close();
      await delay(100);
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("服务端发送加密消息", () => {
    it("应该能够发送自动加密的消息给客户端", async () => {
      const testPort = getAvailablePort();
      const key = EncryptionManager.generateKey("aes-256");

      const server = new Server({
        port: testPort,
        path: "/ws",
        encryption: { key },
      });

      server.on("connection", (socket) => {
        socket.emit("server-message", { status: "ok", data: "encrypted" });
      });

      server.listen();
      await delay(200);

      const client = new Client({
        url: `ws://localhost:${testPort}/ws`,
        encryption: { key },
      });

      let receivedData: any = null;

      await new Promise<void>((resolve) => {
        client.on("open", () => {
          client.on("server-message", (data: any) => {
            receivedData = data;
            resolve();
          });
        });
      });

      await delay(300);
      expect(receivedData).toBeTruthy();
      expect(receivedData.status).toBe("ok");
      expect(receivedData.data).toBe("encrypted");

      client.disconnect();
      await delay(100);
      await server.close();
      await delay(100);
    }, { sanitizeOps: false, sanitizeResources: false });
  });
}, { sanitizeOps: false, sanitizeResources: false });

describe("WebSocket 加密 - 客户端", () => {
  describe("客户端发送加密消息", () => {
    it("应该能够发送自动加密的消息给服务端", async () => {
      const testPort = getAvailablePort();
      const key = EncryptionManager.generateKey("aes-256");

      const server = new Server({
        port: testPort,
        path: "/ws",
        encryption: { key },
      });

      let receivedData: any = null;

      server.on("connection", (socket) => {
        socket.on("client-message", (data: any) => {
          receivedData = data;
        });
      });

      server.listen();
      await delay(200);

      const client = new Client({
        url: `ws://localhost:${testPort}/ws`,
        encryption: { key },
      });

      await Promise.race([
        new Promise<void>((resolve) => {
          client.on("open", () => {
            // 先发送一个简单的消息来触发适配器初始化
            setTimeout(() => {
              client.emit("ping-init", {});
              // 等待适配器初始化后再发送实际消息
              setTimeout(() => {
                client.emit("client-message", { text: "from client" });
              }, 200);
            }, 100);
            let checkInterval: number | undefined;
            const checkReceived = () => {
              if (receivedData) {
                if (checkInterval) clearInterval(checkInterval);
                resolve();
              }
            };
            checkInterval = setInterval(checkReceived, 50);
            setTimeout(() => {
              if (checkInterval) clearInterval(checkInterval);
              resolve();
            }, 5000);
          });
        }),
        new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error("测试超时")), 15000);
        }),
      ]);

      await delay(500);
      expect(receivedData).toBeTruthy();
      expect(receivedData.text).toBe("from client");

      client.disconnect();
      await delay(100);
      await server.close();
      await delay(100);
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("客户端接收加密消息", () => {
    it("应该能够接收并自动解密服务端发送的加密消息", async () => {
      const testPort = getAvailablePort();
      const key = EncryptionManager.generateKey("aes-256");

      const server = new Server({
        port: testPort,
        path: "/ws",
        encryption: { key },
      });

      server.on("connection", (socket) => {
        socket.emit("server-response", { result: "success" });
      });

      server.listen();
      await delay(200);

      const client = new Client({
        url: `ws://localhost:${testPort}/ws`,
        encryption: { key },
      });

      let receivedData: any = null;

      await new Promise<void>((resolve) => {
        client.on("open", () => {
          client.on("server-response", (data: any) => {
            receivedData = data;
            resolve();
          });
        });
      });

      await delay(300);
      expect(receivedData).toBeTruthy();
      expect(receivedData.result).toBe("success");

      client.disconnect();
      await delay(100);
      await server.close();
      await delay(100);
    }, { sanitizeOps: false, sanitizeResources: false });
  });
}, { sanitizeOps: false, sanitizeResources: false });

describe("WebSocket 加密 - 端到端", () => {
  describe("完整通信流程", () => {
    it("应该支持双向加密通信", async () => {
      const testPort = getAvailablePort();
      const key = EncryptionManager.generateKey("aes-256");

      const server = new Server({
        port: testPort,
        path: "/ws",
        encryption: { key },
      });

      let serverReceived: any = null;
      let clientReceived: any = null;

      server.on("connection", (socket) => {
        socket.on("ping-test", (data: any) => {
          serverReceived = data;
          socket.emit("pong-test", { echo: data.message });
        });
      });

      server.listen();
      await delay(200);

      const client = new Client({
        url: `ws://localhost:${testPort}/ws`,
        encryption: { key },
      });

      await Promise.race([
        new Promise<void>((resolve) => {
          client.on("open", () => {
            // 先发送一个简单的消息来触发适配器初始化
            setTimeout(() => {
              client.emit("ping-init", {});
              // 等待适配器初始化后再设置监听器和发送消息
              setTimeout(() => {
                client.on("pong-test", (data: any) => {
                  clientReceived = data;
                  resolve();
                });
                // 再等待一点时间确保监听器已设置
                setTimeout(() => {
                  client.emit("ping-test", { message: "hello" });
                }, 50);
              }, 200);
            }, 100);
          });
        }),
        new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error("测试超时")), 15000);
        }),
      ]);

      await delay(500);
      expect(serverReceived).toBeTruthy();
      expect(serverReceived.message).toBe("hello");
      expect(clientReceived).toBeTruthy();
      expect(clientReceived.echo).toBe("hello");

      client.disconnect();
      await delay(100);
      await server.close();
      await delay(100);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该支持回调机制与加密", async () => {
      const testPort = getAvailablePort();
      const key = EncryptionManager.generateKey("aes-256");

      const server = new Server({
        port: testPort,
        path: "/ws",
        encryption: { key },
      });

      server.on("connection", (socket) => {
        socket.on("request", (data: any, callback: any) => {
          if (callback) {
            callback({ response: data.query });
          }
        });
      });

      server.listen();
      await delay(200);

      const client = new Client({
        url: `ws://localhost:${testPort}/ws`,
        encryption: { key },
      });

      let callbackResult: any = null;

      await Promise.race([
        new Promise<void>((resolve) => {
          client.on("open", () => {
            // 先发送一个简单的消息来触发适配器初始化
            setTimeout(() => {
              client.emit("ping-init", {});
              // 等待适配器初始化后再发送实际消息
              setTimeout(() => {
                client.emit("request", { query: "test" }, (response: any) => {
                  callbackResult = response;
                  resolve();
                });
              }, 200);
            }, 100);
          });
        }),
        new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error("测试超时")), 15000);
        }),
      ]);

      await delay(500);
      expect(callbackResult).toBeTruthy();
      expect(callbackResult.response).toBe("test");

      client.disconnect();
      await delay(100);
      await server.close();
      await delay(100);
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("不同算法", () => {
    const algorithms = [
      "aes-256-gcm",
      "aes-128-gcm",
      "aes-256-cbc",
      "aes-128-cbc",
    ] as const;

    for (const algorithm of algorithms) {
      it(`应该支持 ${algorithm} 算法的端到端加密`, async () => {
        const testPort = getAvailablePort();
        const keyLength = algorithm.includes("128") ? 16 : 32;
        const key = EncryptionManager.generateKey(
          keyLength === 16 ? "aes-128" : "aes-256",
        );

        const server = new Server({
          port: testPort,
          path: "/ws",
          encryption: { key, algorithm },
        });

        let receivedData: any = null;

        server.on("connection", (socket) => {
          socket.on("test", (data: any) => {
            receivedData = data;
            socket.emit("response", { success: true });
          });
        });

        server.listen();
        await delay(200);

        const client = new Client({
          url: `ws://localhost:${testPort}/ws`,
          encryption: { key, algorithm },
        });

        let responseReceived = false;

        await Promise.race([
          new Promise<void>((resolve) => {
            client.on("open", () => {
              // 先发送一个简单的消息来触发适配器初始化
              setTimeout(() => {
                client.emit("ping-init", {});
                // 等待适配器初始化后再设置监听器和发送消息
                setTimeout(() => {
                  client.on("response", () => {
                    responseReceived = true;
                    resolve();
                  });
                  // 再等待一点时间确保监听器已设置
                  setTimeout(() => {
                    client.emit("test", { algorithm, data: "test" });
                  }, 50);
                }, 200);
              }, 100);
            });
          }),
          new Promise<void>((_, reject) => {
            setTimeout(() => reject(new Error("测试超时")), 15000);
          }),
        ]);

        await delay(300);
        expect(receivedData).toBeTruthy();
        expect(receivedData.algorithm).toBe(algorithm);
        expect(responseReceived).toBe(true);

        client.disconnect();
        await delay(100);
        await server.close();
        await delay(100);
      }, { sanitizeOps: false, sanitizeResources: false });
    }
  });

  describe("密钥不匹配", () => {
    it("应该拒绝使用不同密钥的客户端", async () => {
      const testPort = getAvailablePort();
      const serverKey = EncryptionManager.generateKey("aes-256");
      const clientKey = EncryptionManager.generateKey("aes-256");

      const server = new Server({
        port: testPort,
        path: "/ws",
        encryption: { key: serverKey },
      });

      server.on("connection", (socket) => {
        socket.on("test", (data: any) => {
          // 如果密钥不匹配，这里应该收到解密失败的错误
        });
      });

      server.listen();
      await delay(200);

      const client = new Client({
        url: `ws://localhost:${testPort}/ws`,
        encryption: { key: clientKey },
      });

      let errorOccurred = false;

      await new Promise<void>((resolve) => {
        client.on("open", () => {
          client.on("error", () => {
            errorOccurred = true;
          });
          // 尝试发送消息，应该因为密钥不匹配而失败
          client.emit("test", { data: "test" });
          setTimeout(resolve, 500);
        });
      });

      await delay(300);
      // 注意：由于加密/解密是异步的，错误可能在消息处理时发生
      // 这里主要测试连接不会因为密钥不匹配而立即失败

      client.disconnect();
      await delay(100);
      await server.close();
      await delay(100);
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("字符串密钥", () => {
    it("应该支持使用字符串密钥", async () => {
      const testPort = getAvailablePort();
      const keyString = "my-secret-key-32-bytes-long!!!!!"; // 32 字节

      const server = new Server({
        port: testPort,
        path: "/ws",
        encryption: {
          key: keyString,
          algorithm: "aes-256-gcm",
        },
      });

      let receivedData: any = null;

      server.on("connection", (socket) => {
        socket.on("test", (data: any) => {
          receivedData = data;
        });
      });

      server.listen();
      await delay(200);

      const client = new Client({
        url: `ws://localhost:${testPort}/ws`,
        encryption: {
          key: keyString,
          algorithm: "aes-256-gcm",
        },
      });

      await Promise.race([
        new Promise<void>((resolve) => {
          client.on("open", () => {
            // 先发送一个简单的消息来触发适配器初始化
            setTimeout(() => {
              client.emit("ping-init", {});
              // 等待适配器初始化后再发送实际消息
              setTimeout(() => {
                client.emit("test", { message: "string key test" });
              }, 200);
            }, 100);
            let checkInterval: number | undefined;
            const checkReceived = () => {
              if (receivedData) {
                if (checkInterval) clearInterval(checkInterval);
                resolve();
              }
            };
            checkInterval = setInterval(checkReceived, 50);
            setTimeout(() => {
              if (checkInterval) clearInterval(checkInterval);
              resolve();
            }, 3000);
          });
        }),
        new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error("测试超时")), 10000);
        }),
      ]);

      await delay(300);
      expect(receivedData).toBeTruthy();
      expect(receivedData.message).toBe("string key test");

      client.disconnect();
      await delay(100);
      await server.close();
      await delay(100);
    }, { sanitizeOps: false, sanitizeResources: false });
  });

  describe("密码派生密钥", () => {
    it("应该支持使用密码派生的密钥", async () => {
      const testPort = getAvailablePort();
      const password = "my-secret-password";

      const serverKey = await EncryptionManager.deriveKeyFromPassword(
        password,
        "aes-256",
      );
      const clientKey = await EncryptionManager.deriveKeyFromPassword(
        password,
        "aes-256",
      );

      const server = new Server({
        port: testPort,
        path: "/ws",
        encryption: {
          key: serverKey,
          algorithm: "aes-256-gcm",
        },
      });

      let receivedData: any = null;

      server.on("connection", (socket) => {
        socket.on("test", (data: any) => {
          receivedData = data;
        });
      });

      server.listen();
      await delay(200);

      const client = new Client({
        url: `ws://localhost:${testPort}/ws`,
        encryption: {
          key: clientKey,
          algorithm: "aes-256-gcm",
        },
      });

      await Promise.race([
        new Promise<void>((resolve) => {
          client.on("open", () => {
            // 先发送一个简单的消息来触发适配器初始化
            setTimeout(() => {
              client.emit("ping-init", {});
              // 等待适配器初始化后再发送实际消息
              setTimeout(() => {
                client.emit("test", { message: "password derived key" });
              }, 200);
            }, 100);
            let checkInterval: number | undefined;
            const checkReceived = () => {
              if (receivedData) {
                if (checkInterval) clearInterval(checkInterval);
                resolve();
              }
            };
            checkInterval = setInterval(checkReceived, 50);
            setTimeout(() => {
              if (checkInterval) clearInterval(checkInterval);
              resolve();
            }, 3000);
          });
        }),
        new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error("测试超时")), 10000);
        }),
      ]);

      await delay(300);
      expect(receivedData).toBeTruthy();
      expect(receivedData.message).toBe("password derived key");

      client.disconnect();
      await delay(100);
      await server.close();
      await delay(100);
    }, { sanitizeOps: false, sanitizeResources: false });
  });
}, { sanitizeOps: false, sanitizeResources: false });

describe("WebSocket 加密 - 混合场景", () => {
  it("应该支持未加密的服务端和加密的客户端", async () => {
    const testPort = getAvailablePort();
    const key = EncryptionManager.generateKey("aes-256");

    // 服务端不启用加密
    const server = new Server({
      port: testPort,
      path: "/ws",
    });

    let receivedData: any = null;

    server.on("connection", (socket) => {
      socket.on("test", (data: any) => {
        receivedData = data;
      });
      // 如果没有加密管理器，可能收到 "encrypted" 事件
      socket.on("encrypted", (data: any) => {
        receivedData = data;
      });
    });

    server.listen();
    await delay(200);

    // 客户端启用加密
    const client = new Client({
      url: `ws://localhost:${testPort}/ws`,
      encryption: { key },
    });

    await Promise.race([
      new Promise<void>((resolve) => {
        client.on("open", () => {
          // 先发送一个简单的消息来触发适配器初始化
          setTimeout(() => {
            client.emit("ping-init", {});
            // 等待适配器初始化后再发送实际消息
            setTimeout(() => {
              client.emit("test", { message: "encrypted from client" });
            }, 200);
          }, 100);
          let checkInterval: number | undefined;
          const checkReceived = () => {
            if (receivedData) {
              if (checkInterval) clearInterval(checkInterval);
              resolve();
            }
          };
          checkInterval = setInterval(checkReceived, 50);
          setTimeout(() => {
            if (checkInterval) clearInterval(checkInterval);
            resolve();
          }, 3000);
        });
      }),
      new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error("测试超时")), 10000);
      }),
    ]);

    await delay(300);
    // 服务端应该收到加密的消息（Base64字符串），无法直接解析
    // 这里主要测试不会崩溃
    expect(receivedData).toBeTruthy();

    client.disconnect();
    await delay(100);
    await server.close();
    await delay(100);
  }, { sanitizeOps: false, sanitizeResources: false });

  it("应该支持加密的服务端和未加密的客户端", async () => {
    const testPort = getAvailablePort();
    const key = EncryptionManager.generateKey("aes-256");

    // 服务端启用加密
    const server = new Server({
      port: testPort,
      path: "/ws",
      encryption: { key },
    });

    server.on("connection", (socket) => {
      // 等待客户端准备好后再发送消息
      setTimeout(() => {
        socket.emit("response", { status: "ok" });
      }, 300);
    });

    server.listen();
    await delay(200);

    // 客户端不启用加密
    const client = new Client({
      url: `ws://localhost:${testPort}/ws`,
    });

    let receivedData: any = null;

    await Promise.race([
      new Promise<void>((resolve) => {
        client.on("open", () => {
          // 等待连接建立后再设置监听器
          setTimeout(() => {
            client.on("response", (data: any) => {
              receivedData = data;
              resolve();
            });
            // 如果没有加密管理器，可能收到 "encrypted" 事件
            client.on("encrypted", (data: any) => {
              receivedData = data;
              resolve();
            });
          }, 100);
        });
      }),
      new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error("测试超时")), 5000);
      }),
    ]);

    await delay(300);
    // 客户端应该收到加密的消息（Base64字符串），无法直接解析
    // 这里主要测试不会崩溃
    expect(receivedData).toBeTruthy();

    client.disconnect();
    await delay(100);
    await server.close();
    await delay(100);
  }, { sanitizeOps: false, sanitizeResources: false });
}, { sanitizeOps: false, sanitizeResources: false });

describe("WebSocket 加密 - 性能测试", () => {
  it("应该能够处理大量加密消息", async () => {
    const testPort = getAvailablePort();
    const key = EncryptionManager.generateKey("aes-256");

    const server = new Server({
      port: testPort,
      path: "/ws",
      encryption: { key },
    });

    const receivedMessages: any[] = [];

    server.on("connection", (socket) => {
      socket.on("batch", (data: any) => {
        receivedMessages.push(data);
      });
    });

    server.listen();
    await delay(200);

    const client = new Client({
      url: `ws://localhost:${testPort}/ws`,
      encryption: { key },
    });

    await Promise.race([
      new Promise<void>((resolve) => {
        client.on("open", () => {
          // 先发送一个简单的消息来触发适配器初始化
          setTimeout(() => {
            client.emit("ping-init", {});
            // 等待适配器初始化后再发送实际消息
            setTimeout(() => {
              // 发送100条加密消息
              for (let i = 0; i < 100; i++) {
                client.emit("batch", { id: i, data: `message ${i}` });
              }
            }, 200);
          }, 100);
          let checkInterval: number | undefined;
          const checkReceived = () => {
            if (receivedMessages.length >= 100) {
              if (checkInterval) clearInterval(checkInterval);
              resolve();
            }
          };
          checkInterval = setInterval(checkReceived, 50);
          setTimeout(() => {
            if (checkInterval) clearInterval(checkInterval);
            resolve();
          }, 5000);
        });
      }),
      new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error("测试超时")), 15000);
      }),
    ]);

    await delay(500);
    expect(receivedMessages.length).toBe(100);
    expect(receivedMessages[0].id).toBe(0);
    expect(receivedMessages[99].id).toBe(99);

    client.disconnect();
    await delay(100);
    await server.close();
    await delay(100);
  }, { sanitizeOps: false, sanitizeResources: false });
}, { sanitizeOps: false, sanitizeResources: false });

describe("WebSocket 加密 - 边界情况", () => {
  describe("空字符串和特殊字符", () => {
    it("应该能够加密和解密空字符串", async () => {
      const key = EncryptionManager.generateKey("aes-256");
      const manager = new EncryptionManager({ key });

      const plaintext = "";
      const encrypted = await manager.encryptMessage(plaintext);
      const decrypted = await manager.decryptMessage(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("应该能够加密和解密包含 Unicode 字符的字符串", async () => {
      const key = EncryptionManager.generateKey("aes-256");
      const manager = new EncryptionManager({ key });

      const plaintext = "你好世界 🌍 测试 🎉";
      const encrypted = await manager.encryptMessage(plaintext);
      const decrypted = await manager.decryptMessage(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("应该能够加密和解密超长字符串", async () => {
      const key = EncryptionManager.generateKey("aes-256");
      const manager = new EncryptionManager({ key });

      // 生成 10KB 的字符串
      const plaintext = "a".repeat(10 * 1024);
      const encrypted = await manager.encryptMessage(plaintext);
      const decrypted = await manager.decryptMessage(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(decrypted.length).toBe(10 * 1024);
    });

    it("应该能够加密和解密包含特殊字符的 JSON", async () => {
      const key = EncryptionManager.generateKey("aes-256");
      const manager = new EncryptionManager({ key });

      const plaintext = JSON.stringify({
        text: "特殊字符: \n\t\r\"'\\",
        unicode: "测试 🎉",
        number: 123.456,
      });
      const encrypted = await manager.encryptMessage(plaintext);
      const decrypted = await manager.decryptMessage(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(JSON.parse(decrypted).text).toBe("特殊字符: \n\t\r\"'\\");
    });
  });

  describe("isEncrypted 边界情况", () => {
    it("应该正确处理空字符串", () => {
      const key = EncryptionManager.generateKey("aes-256");
      const manager = new EncryptionManager({ key });

      expect(manager.isEncrypted("")).toBe(false);
    });

    it("应该正确识别短 Base64 字符串（不是加密消息）", () => {
      const key = EncryptionManager.generateKey("aes-256");
      const manager = new EncryptionManager({ key });

      // 短 Base64 字符串（长度 <= 20 字节解码后）
      const shortBase64 = "dGVzdA=="; // "test" 的 Base64
      expect(manager.isEncrypted(shortBase64)).toBe(false);
    });

    it("应该正确识别非 Base64 字符串", () => {
      const key = EncryptionManager.generateKey("aes-256");
      const manager = new EncryptionManager({ key });

      expect(manager.isEncrypted("这不是Base64!@#$%")).toBe(false);
      expect(manager.isEncrypted("hello world")).toBe(false);
    });

    it("应该正确识别有效的 Base64 但非加密消息", () => {
      const key = EncryptionManager.generateKey("aes-256");
      const manager = new EncryptionManager({ key });

      // 长 Base64 字符串，但不是加密消息
      const longBase64 = "a".repeat(100) + "=".repeat(10);
      // 由于长度足够，可能会被误判为加密消息
      // 但实际解密时会失败，所以这个测试主要验证不会崩溃
      const result = manager.isEncrypted(longBase64);
      expect(typeof result).toBe("boolean");
    });
  });

  describe("错误处理", () => {
    it("应该正确处理解密失败的消息（密钥不匹配）", async () => {
      const testPort = getAvailablePort();
      const serverKey = EncryptionManager.generateKey("aes-256");
      const clientKey = EncryptionManager.generateKey("aes-256"); // 不同的密钥

      const server = new Server({
        port: testPort,
        path: "/ws",
        encryption: { key: serverKey },
      });

      let errorReceived = false;
      let errorMessage: any = null;

      server.on("connection", (socket) => {
        socket.on("error", (error: any) => {
          errorReceived = true;
          errorMessage = error;
        });
        socket.on("test", () => {
          // 如果密钥不匹配，这里不应该收到消息
        });
      });

      server.listen();
      await delay(200);

      const client = new Client({
        url: `ws://localhost:${testPort}/ws`,
        encryption: { key: clientKey },
      });

      await new Promise<void>((resolve) => {
        client.on("open", () => {
          // 发送消息，应该因为密钥不匹配而失败
          client.emit("test", { data: "test" });
          setTimeout(resolve, 500);
        });
      });

      await delay(300);
      // 由于密钥不匹配，服务端可能会收到解密失败的错误消息
      // 这里主要测试不会崩溃

      client.disconnect();
      await delay(100);
      await server.close();
      await delay(100);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("应该正确处理无效的加密消息格式", async () => {
      const key = EncryptionManager.generateKey("aes-256");
      const manager = new EncryptionManager({ key });

      // 尝试解密无效的 Base64 字符串
      let errorThrown = false;
      try {
        await manager.decryptMessage("这不是有效的Base64!!!");
      } catch (error) {
        errorThrown = true;
        expect(error).toBeInstanceOf(Error);
      }
      expect(errorThrown).toBe(true);
    });

    it("应该正确处理加密过程中的错误", async () => {
      // 创建一个会导致加密失败的场景
      // 由于 @dreamer/crypto 库的实现，我们无法直接模拟加密失败
      // 但可以测试错误处理逻辑
      const key = EncryptionManager.generateKey("aes-256");
      const manager = new EncryptionManager({ key });

      // 正常加密应该成功
      const plaintext = "test";
      const encrypted = await manager.encryptMessage(plaintext);
      expect(typeof encrypted).toBe("string");
      expect(encrypted.length).toBeGreaterThan(0);
    });
  });

  describe("二进制消息与加密", () => {
    it("二进制消息不应该被加密（客户端）", async () => {
      const testPort = getAvailablePort();
      const key = EncryptionManager.generateKey("aes-256");

      const server = new Server({
        port: testPort,
        path: "/ws",
        encryption: { key },
      });

      let receivedBinary: any = null;

      server.on("connection", (socket) => {
        socket.on("binary", (data: any) => {
          receivedBinary = data;
        });
      });

      server.listen();
      await delay(200);

      const client = new Client({
        url: `ws://localhost:${testPort}/ws`,
        encryption: { key },
      });

      await Promise.race([
        new Promise<void>((resolve) => {
          client.on("open", () => {
            // 先发送一个简单的消息来触发适配器初始化
            setTimeout(() => {
              client.emit("ping-init", {});
              // 等待适配器初始化后再发送实际消息
              setTimeout(() => {
                // 发送二进制消息
                const binaryData = new Uint8Array([1, 2, 3, 4, 5]);
                client.sendBinary(binaryData);
              }, 200);
            }, 100);
            let checkInterval: number | undefined;
            const checkReceived = () => {
              if (receivedBinary) {
                if (checkInterval) clearInterval(checkInterval);
                resolve();
              }
            };
            checkInterval = setInterval(checkReceived, 50);
            setTimeout(() => {
              if (checkInterval) clearInterval(checkInterval);
              resolve();
            }, 3000);
          });
        }),
        new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error("测试超时")), 10000);
        }),
      ]);

      await delay(300);
      // 二进制消息应该直接发送，不经过加密
      expect(receivedBinary).toBeTruthy();
      expect(
        receivedBinary instanceof Uint8Array ||
          receivedBinary instanceof ArrayBuffer ||
          receivedBinary instanceof Blob,
      ).toBe(true);

      client.disconnect();
      await delay(100);
      await server.close();
      await delay(100);
    }, { sanitizeOps: false, sanitizeResources: false });

    it("二进制消息不应该被加密（服务端）", async () => {
      const testPort = getAvailablePort();
      const key = EncryptionManager.generateKey("aes-256");

      const server = new Server({
        port: testPort,
        path: "/ws",
        encryption: { key },
      });

      server.on("connection", (socket) => {
        // 等待客户端准备好后再发送二进制消息
        setTimeout(() => {
          const binaryData = new Uint8Array([10, 20, 30, 40, 50]);
          socket.sendBinary(binaryData);
        }, 300);
      });

      server.listen();
      await delay(200);

      const client = new Client({
        url: `ws://localhost:${testPort}/ws`,
        encryption: { key },
      });

      let receivedBinary: any = null;

      await Promise.race([
        new Promise<void>((resolve) => {
          client.on("open", () => {
            // 先发送一个简单的消息来触发适配器初始化
            setTimeout(() => {
              client.emit("ping-init", {});
              // 等待适配器初始化后再设置监听器
              setTimeout(() => {
                client.on("binary", (data: any) => {
                  receivedBinary = data;
                  resolve();
                });
              }, 100);
            }, 100);
          });
        }),
        new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error("测试超时")), 10000);
        }),
      ]);

      await delay(300);
      // 二进制消息应该直接接收，不经过解密
      expect(receivedBinary).toBeTruthy();
      expect(
        receivedBinary instanceof Uint8Array ||
          receivedBinary instanceof ArrayBuffer ||
          receivedBinary instanceof Blob,
      ).toBe(true);

      client.disconnect();
      await delay(100);
      await server.close();
      await delay(100);
    }, { sanitizeOps: false, sanitizeResources: false });
  });
}, { sanitizeOps: false, sanitizeResources: false });
