/**
 * dsh-feishu 统一错误处理
 *
 * 飞书 API 错误码映射
 * 来源：飞书开放平台官方文档 + 实测
 */

export class FeishuApiError extends Error {
  constructor(
    message: string,
    public readonly code: string, // eslint-disable-line no-unused-vars
    public readonly statusCode?: number // eslint-disable-line no-unused-vars
  ) {
    super(message)
    this.name = 'FeishuApiError'
  }
}

/** 常见飞书错误码映射 */
const ERROR_CODE_MAP: Record<string, string> = {
  // 认证错误
  '99991401': 'App Secret 错误或应用不存在，请检查配置',
  '99991403': 'tenant_access_token 已过期，请稍后重试',
  '99991411': 'app_access_token 过期，请刷新',
  '99991400': '请求参数错误',

  // 权限错误
  '99991664': '权限不足，请检查应用是否开通了对应权限',
  '99991661': '应用未安装或已被禁用',

  // 资源错误
  '230001': '请求频率超限（5 QPS），请稍后重试',
  '230002': '文件不存在或已被删除',
  '230003': '文件名无效或包含非法字符',
  '230004': '不支持的文件格式',
  '230005': '文件数量超出限制',
  '230013': '文件超过 20MB 限制',
  '230014': '文件夹容量超出限制',
  '230020': '云盘空间不足',

  // 文档错误
  '130001': '文档不存在或无访问权限',
  '130002': '文档已被删除',
  '130003': '禁止访问此文档',
  '130004': '文档标题无效',

  // 多维表格错误
  '150001': '多维表格不存在或无权访问',
  '150002': '数据表不存在',
  '150003': '记录不存在或已删除',
  '150004': '字段数量超出限制',
  '150005': '记录数量超出限制',

  // 通用错误
  '99991660': '请求内容过长',
  '99991663': '请求格式错误',
}

/**
 * 将任意错误转换为 FeishuApiError
 */
export function wrapFeishuError(e: unknown, defaultMsg: string): FeishuApiError {
  if (e instanceof FeishuApiError) return e

  if (e && typeof e === 'object') {
    const obj = e as Record<string, unknown>
    const code = obj.code != null ? String(obj.code) : 'UNKNOWN'
    const msg = typeof obj.msg === 'string' ? obj.msg
      : typeof obj.message === 'string' ? obj.message
      : undefined

    const mapped = ERROR_CODE_MAP[code]
    if (mapped) return new FeishuApiError(mapped, code)

    return new FeishuApiError(msg ?? defaultMsg, code)
  }

  if (e instanceof Error) {
    return new FeishuApiError(e.message, 'UNKNOWN')
  }

  return new FeishuApiError(defaultMsg, 'UNKNOWN')
}

/** 检查是否是路径安全错误 */
export function isPathError(e: unknown): boolean {
  return e instanceof Error && e.name === 'PATH_FORBIDDEN'
}

/** 构造一个 FeishuApiError 的辅助函数 */
export function feishuError(message: string, code: string): FeishuApiError {
  return new FeishuApiError(message, code)
}
