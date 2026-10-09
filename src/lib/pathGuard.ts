/**
 * dsh-feishu 路径安全验证
 *
 * ⚠️ P0-5 修复：防止任意文件读写
 *    只允许访问 DSH 工作区目录，禁用路径穿越
 */

import path from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'

// ============================================================================
// 允许访问的根目录白名单
// ============================================================================

const ALLOWED_ROOTS: string[] = [
  // DSH 默认数据目录
  process.env.DSH_HOME ?? path.join(process.env.HOME ?? 'C:\\', '.dsh'),
  // 临时目录
  process.env.TMP ?? process.env.TEMP ?? '/tmp',
  // 用户文档目录（fallback）
  process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, 'Documents')
    : path.join(process.env.HOME ?? '', 'Documents'),
]

/** 规范化路径（处理 .. 穿越） */
function normalize(p: string): string {
  return path.normalize(path.resolve(p))
}

/**
 * 验证路径是否在白名单目录内
 *
 * @param filePath 用户提供的文件路径
 * @returns true = 允许读写，false = 拒绝
 */
export function isPathAllowed(filePath: string): boolean {
  const resolved = normalize(filePath)
  return ALLOWED_ROOTS.some((root) => resolved.startsWith(normalize(root)))
}

/**
 * 安全读取文件（仅白名单内）
 * @throws FeishuApiError 如果路径不在白名单内
 */
export function safeReadFile(filePath: string): Buffer {
  if (!isPathAllowed(filePath)) {
    const err = new Error(`路径不在允许范围内: ${filePath}`)
    err.name = 'PATH_FORBIDDEN'
    throw err
  }
  return readFileSync(filePath)
}

/**
 * 安全写入文件（仅白名单内）
 * @throws FeishuApiError 如果路径不在白名单内
 */
export function safeWriteFile(filePath: string, data: Buffer | string): void {
  if (!isPathAllowed(filePath)) {
    const err = new Error(`路径不在允许范围内: ${filePath}`)
    err.name = 'PATH_FORBIDDEN'
    throw err
  }
  writeFileSync(filePath, data)
}
