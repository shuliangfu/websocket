# WebSocket 大量连接优化方案

## 当前实现分析

### 已有的优化

1. **分批发送消息**：
   - 房间广播：超过 100 个连接时，每批 50 个异步发送
   - 全局广播：超过 100 个连接时，每批 50 个异步发送
   - 使用 `setTimeout` 让出事件循环

2. **连接管理**：
   - 使用 `Map` 存储连接，O(1) 查找
   - 使用 `Set` 存储房间成员，O(1) 添加/删除

### 性能瓶颈

1. **消息序列化**：每条消息都需要序列化，大量连接时成为瓶颈
2. **事件循环阻塞**：同步发送大量消息会阻塞事件循环
3. **内存占用**：每个连接都维护独立的状态和监听器
4. **心跳检测**：每个连接独立的心跳定时器
5. **消息加密**：每条消息都需要加密/解密操作

---

## 优化方案

### 1. 消息序列化优化

**问题**：每条消息都单独序列化，大量连接时重复序列化相同数据。

**优化方案**：
- 对于相同消息，只序列化一次，然后复用
- 使用消息缓存池
- 对于只读数据，使用共享引用

```typescript
// 优化前：每条消息都序列化
for (const socket of sockets) {
  socket.emit(event, data); // 每次都序列化 data
}

// 优化后：序列化一次，复用结果
const serialized = await serializeMessage({ type: "event", event, data }, encryptionManager);
for (const socket of sockets) {
  socket.sendRaw(serialized); // 直接发送已序列化的数据
}
```

### 2. 批量发送优化

**问题**：当前使用 `setTimeout(fn, 0)` 分批发送，可能不够高效。

**优化方案**：
- 使用 `queueMicrotask` 或 `scheduler.postTask`（如果可用）
- 使用 `setImmediate` 风格的调度
- 根据系统负载动态调整批次大小

```typescript
// 优化前
setTimeout(sendBatch, 0);

// 优化后：使用更高效的调度
if (typeof queueMicrotask === 'function') {
  queueMicrotask(sendBatch);
} else {
  setTimeout(sendBatch, 0);
}

// 或者使用动态批次大小
const batchSize = Math.min(50, Math.max(10, Math.floor(sockets.length / 100)));
```

### 3. 心跳检测优化

**问题**：每个连接独立的心跳定时器，大量连接时定时器过多。

**优化方案**：
- 使用统一的心跳管理器，批量处理心跳
- 使用时间轮（Time Wheel）算法
- 心跳消息批量发送

```typescript
// 优化方案：统一心跳管理器
class BatchHeartbeatManager {
  private connections: Set<Socket> = new Set();
  private interval: number;
  
  add(socket: Socket) {
    this.connections.add(socket);
  }
  
  remove(socket: Socket) {
    this.connections.delete(socket);
  }
  
  start() {
    setInterval(() => {
      // 批量发送心跳
      const pings = Array.from(this.connections);
      for (const socket of pings) {
        if (socket.connected) {
          socket.sendPing();
        }
      }
    }, this.interval);
  }
}
```

### 4. 内存优化

**问题**：每个连接维护独立的状态，内存占用大。

**优化方案**：
- 使用对象池复用 Socket 对象
- 使用 WeakMap 存储临时数据
- 延迟初始化非必要属性
- 定期清理无效连接

```typescript
// 使用对象池
class SocketPool {
  private pool: Socket[] = [];
  
  acquire(): Socket {
    return this.pool.pop() || new Socket();
  }
  
  release(socket: Socket) {
    socket.reset();
    this.pool.push(socket);
  }
}

// 使用 WeakMap 存储临时数据
const socketData = new WeakMap<Socket, SocketData>();
```

### 5. 连接池和负载均衡

**问题**：单服务器处理大量连接，成为瓶颈。

**优化方案**：
- 使用多进程/多线程
- 使用 Redis 等外部存储进行连接路由
- 使用负载均衡器分发连接

```typescript
// 使用 Redis 进行连接路由
import { RedisAdapter } from "@dreamer/cache";

class DistributedServer {
  private redis: RedisAdapter;
  
  async broadcast(event: string, data: any) {
    // 获取所有服务器节点
    const nodes = await this.redis.keys("server:*");
    
    // 向每个节点发送广播请求
    for (const node of nodes) {
      await this.redis.publish(node, { event, data });
    }
  }
}
```

### 6. 消息队列优化

**问题**：大量消息同时发送时，可能造成内存压力。

**优化方案**：
- 使用消息队列缓冲
- 限制队列大小，丢弃旧消息
- 使用背压（Backpressure）机制

```typescript
class MessageQueue {
  private queue: Array<{ socket: Socket; message: any }> = [];
  private maxSize: number = 10000;
  private processing = false;
  
  enqueue(socket: Socket, message: any) {
    if (this.queue.length >= this.maxSize) {
      // 丢弃最旧的消息
      this.queue.shift();
    }
    this.queue.push({ socket, message });
    this.process();
  }
  
  async process() {
    if (this.processing) return;
    this.processing = true;
    
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, 100);
      for (const { socket, message } of batch) {
        await socket.send(message);
      }
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    this.processing = false;
  }
}
```

### 7. 加密优化

**问题**：每条消息都加密，大量连接时 CPU 占用高。

**优化方案**：
- 使用硬件加速（如果可用）
- 批量加密
- 缓存加密结果（对于相同消息）
- 使用更快的加密算法（AES-128-GCM 比 AES-256-GCM 快）

```typescript
// 缓存加密结果
class EncryptionCache {
  private cache = new Map<string, string>();
  
  async encrypt(data: string, manager: EncryptionManager): Promise<string> {
    const key = this.hash(data);
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }
    
    const encrypted = await manager.encryptMessage(data);
    this.cache.set(key, encrypted);
    return encrypted;
  }
}
```

### 8. 数据结构优化

**问题**：使用 Map 和 Set，但可以进一步优化。

**优化方案**：
- 使用更紧凑的数据结构
- 使用索引加速查找
- 使用位图（Bitmap）存储房间成员（如果房间数较少）

```typescript
// 使用索引加速房间查找
class OptimizedRoomManager {
  private roomIndex: Map<string, Set<string>> = new Map();
  private socketIndex: Map<string, Set<string>> = new Map(); // socket -> rooms
  
  getRoomsForSocket(socketId: string): Set<string> {
    return this.socketIndex.get(socketId) || new Set();
  }
  
  getSocketsInRoom(room: string): Set<string> {
    return this.roomIndex.get(room) || new Set();
  }
}
```

---

## 实施建议

### 短期优化（易于实现）

1. **消息序列化缓存**：对于相同消息，只序列化一次
2. **动态批次大小**：根据连接数动态调整批次大小
3. **心跳批量处理**：统一心跳管理器，批量发送心跳
4. **连接清理优化**：定期清理无效连接，释放资源

### 中期优化（需要重构）

1. **消息队列系统**：实现消息队列，缓冲和批量处理消息
2. **对象池**：使用对象池复用 Socket 对象
3. **加密缓存**：缓存加密结果，减少重复加密
4. **数据结构优化**：优化房间和连接的数据结构

### 长期优化（架构级）

1. **分布式架构**：使用 Redis 等实现分布式 WebSocket 服务器
2. **负载均衡**：使用负载均衡器分发连接
3. **多进程/多线程**：使用 Worker 线程处理大量连接
4. **硬件加速**：使用硬件加速加密（如果可用）

---

## 性能指标

### 目标性能

- **连接数**：支持 10,000+ 并发连接
- **消息吞吐**：10,000+ 消息/秒
- **延迟**：P99 延迟 < 100ms
- **内存占用**：每个连接 < 10KB

### 监控指标

- 连接数
- 消息发送速率
- 消息延迟（P50, P95, P99）
- CPU 使用率
- 内存使用率
- 事件循环延迟

---

## 测试建议

1. **压力测试**：使用工具模拟 10,000+ 并发连接
2. **性能测试**：测试消息吞吐量和延迟
3. **内存测试**：监控内存使用和泄漏
4. **稳定性测试**：长时间运行测试

---

## 参考实现

可以参考以下优化实现：

1. **Socket.IO**：使用 Redis 适配器实现分布式
2. **ws**：使用流式处理优化大量连接
3. **uWebSockets**：C++ 实现，性能极高

---

## 总结

对于大量连接（>10,000）的优化，主要从以下几个方面入手：

1. **减少重复计算**：消息序列化、加密缓存
2. **批量处理**：批量发送消息、批量心跳
3. **异步调度**：使用更高效的调度机制
4. **内存优化**：对象池、数据结构优化
5. **架构优化**：分布式、负载均衡

建议优先实施短期优化，然后根据实际需求逐步实施中期和长期优化。
