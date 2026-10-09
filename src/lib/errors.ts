/**
 * dsh-feishu 统一错误处理
 *
 * 飞书 API 错误码映射
 * 来源：飞书开放平台官方文档（待实测核实）
 */

export class FeishuApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message)
    this.name = 'FeishuApiError'
  }
}

/**
 * 将任意错误转换为 FeishuApiError
 * 同时做飞书错误码映射
 */
export function wrapFeishuError(e: unknown, defaultMsg: string): FeishuApiError {
  if (e instanceof FeishuApiError) return e

  if (e && typeof e === 'object' && 'code' in e) {
    const code = String((e as Record<string, unknown>).code)
    const msg = (e as Record<string, unknown>).msg as string | undefined

    if (code === '99991401') return new FeishuApiError('App Secret 错误或应用不存在', code)
    if (code === '99991664') return new FeishuApiError('权限不足，请检查应用是否开通了对应权限', code)
    if (code === '230013') return new FeishuApiError('文件超过 20MB 限制', code)
    if (code === '230001') return new FeishuApiError('请求频率超限（5 QPS），请稍后重试', code)
    if (code === '99991403') return new FeishuApiError('tenant_access_token 已过期，请刷新', code)

    return new FeishuApiError(msg ?? defaultMsg, code)
  }

  return new FeishuApiError(defaultMsg, 'UNKNOWN')
}

/** 检查是否是路径安全错误 */
export function isPathError(e: unknown): boolean {
  return e instanceof Error && e.name === 'PATH_FORBIDDEN'
}
