/**
 * @fileoverview 快速哈希工具
 * 用于 MessageCache 等场景，替代 JSON.stringify 作为哈希输入
 */

/**
 * FNV-1a 32 位哈希（非加密，适用于缓存键）
 * 比 JSON.stringify 更快，适合结构化数据的快速哈希
 * @param str 输入字符串
 * @returns 32 位哈希值（十六进制字符串）
 */
export function fnv1aHash(str: string): string {
  let hash = 2166136261; // FNV offset basis
  const len = str.length;
  for (let i = 0; i < len; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }
  return (hash >>> 0).toString(16);
}
