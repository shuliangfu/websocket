/**
 * @fileoverview 运行示例测试
 * 逐个运行有 import.meta.main 的示例文件
 */

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 运行单个示例
 */
async function runExample(name: string): Promise<boolean> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`运行示例: ${name}`);
  console.log(`${"=".repeat(60)}`);

  try {
    // 使用 Deno 运行示例文件
    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "--allow-net",
        "--allow-read",
        `examples/${name}.ts`,
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await command.output();

    if (code === 0) {
      console.log(`✅ ${name} 运行成功`);
      const output = new TextDecoder().decode(stdout);
      if (output) {
        console.log("输出:", output.slice(0, 200)); // 只显示前200个字符
      }
      return true;
    } else {
      console.error(`❌ ${name} 运行失败 (退出码: ${code})`);
      const error = new TextDecoder().decode(stderr);
      if (error) {
        console.error("错误:", error.slice(0, 500)); // 只显示前500个字符
      }
      return false;
    }
  } catch (error) {
    console.error(`❌ ${name} 运行异常:`, error);
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log("开始运行所有可执行的示例文件...\n");

  // 只运行有 import.meta.main 的示例
  const examples = [
    "encryption-basic",
    "encryption-binary",
    "encryption-chat-app",
    "encryption-example",
    "encryption-key-management",
    "encryption-mixed",
    "encryption-password-based",
  ];

  const results: Array<{ name: string; success: boolean }> = [];

  for (const example of examples) {
    const success = await runExample(example);
    results.push({ name: example, success });
    await delay(1000); // 等待端口释放
  }

  // 输出结果摘要
  console.log(`\n${"=".repeat(60)}`);
  console.log("运行结果摘要");
  console.log(`${"=".repeat(60)}`);

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`总计: ${results.length} 个示例`);
  console.log(`成功: ${passed} 个`);
  console.log(`失败: ${failed} 个`);

  if (failed > 0) {
    console.log("\n失败的示例:");
    results.filter((r) => !r.success).forEach((r) => {
      console.log(`  - ${r.name}`);
    });
  }

  console.log(`\n${"=".repeat(60)}`);

  return failed === 0;
}

// 运行测试
if (import.meta.main) {
  const success = await main();
  Deno.exit(success ? 0 : 1);
}
