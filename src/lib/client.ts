/**
 * dsh-feishu FeishuClient 封装
 *
 * ⚠️ P0-2 修复：使用 Map<profileId, Client> 而非全局单例
 *    确保多 Profile 环境下各账号 token 隔离
 */

import { Client, LoggerLevel } from '@larksuiteoapi/node-sdk'
import type { FeishuConfig } from './types'

// ============================================================================
// 多 Profile Client 管理（P0-2 核心修复）
// ============================================================================

/**
 * Client 实例池 — key = DSH profile id
 * 每个 DSH profile 独立一个 Client 实例，token 完全隔离
 */
const _clients = new Map<string, Client>()

/**
 * 获取当前 Profile 的 Feishu Client
 * 每次调用返回该 Profile 专属实例（懒创建）
 */
export function getFeishuClient(profileId: string, config: FeishuConfig): Client {
  if (!_clients.has(profileId)) {
    const client = new Client({
      appId: config.appId,
      appSecret: config.appSecret,
      loggerLevel: LoggerLevel.error,  // ⚠️ P0 安全：只用 error 级别，不打请求/响应体
    })
    _clients.set(profileId, client)
  }
  return _clients.get(profileId)!
}

/**
 * 重置指定 Profile 的 Client
 * 用户修改 App Secret 时调用，确保下次 getFeishuClient 用新凭证重建
 */
export function resetClientForProfile(profileId: string): void {
  _clients.delete(profileId)
}

/**
 * 重置所有 Profile 的 Client
 * 用于插件卸载或全局重置
 */
export function resetAllClients(): void {
  _clients.clear()
}

// ============================================================================
// SDK 辅助方法
// ============================================================================

/**
 * 验证 App ID 格式（飞书 App ID 以 cli_ 开头）
 */
export function isValidAppId(appId: string): boolean {
  return appId.startsWith('cli_') && appId.length >= 18
}
