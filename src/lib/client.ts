/**
 * dsh-feishu FeishuClient 封装
 *
 * 每个 profile 独立一个 Client 实例，token 完全隔离
 */

import * as lark from '@larksuiteoapi/node-sdk'
import type { FeishuConfig } from './types'

// ============================================================================
// 多 Profile Client 管理
// ============================================================================

/**
 * Client 实例池 — key = DSH profile id
 * 每个 DSH profile 独立一个 Client 实例，token 完全隔离
 */
const _clients = new Map<string, lark.Client>()

/**
 * 获取当前 Profile 的 Feishu Client
 * 每次调用返回该 Profile 专属实例（懒创建）
 */
export function getFeishuClient(profileId: string, config: FeishuConfig): lark.Client {
  if (!_clients.has(profileId)) {
    const client = new lark.Client({
      appId: config.appId,
      appSecret: config.appSecret,
      loggerLevel: lark.LoggerLevel.error,
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

/**
 * 验证 App ID 格式（飞书 App ID 以 cli_ 开头）
 */
export function isValidAppId(appId: string): boolean {
  return appId.startsWith('cli_') && appId.length >= 18
}

// Re-export SDK types for convenience
export type { FeishuConfig } from './types'
export type Client = lark.Client