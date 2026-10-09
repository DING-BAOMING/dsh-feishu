/**
 * dsh-feishu 错误处理测试
 */

import { describe, it, expect } from 'vitest'
import { wrapFeishuError, FeishuApiError, feishuError, isPathError } from '../../src/lib/errors'

describe('FeishuApiError', () => {
  it('应正确保存 code 和 message', () => {
    const err = new FeishuApiError('测试消息', '230013')
    expect(err.message).toBe('测试消息')
    expect(err.code).toBe('230013')
    expect(err.name).toBe('FeishuApiError')
    expect(err instanceof Error).toBe(true)
  })

  it('应支持 statusCode', () => {
    const err = new FeishuApiError('消息', '999', 404)
    expect(err.statusCode).toBe(404)
  })
})

describe('wrapFeishuError', () => {
  it('FeishuApiError 输入应直接返回', () => {
    const original = new FeishuApiError('原始', '230001')
    const wrapped = wrapFeishuError(original, '默认')
    expect(wrapped).toBe(original)
    expect(wrapped.code).toBe('230001')
  })

  it('飞书错误码 230013 应映射到"文件超过限制"', () => {
    const e = { code: '230013', msg: 'file too large' }
    const wrapped = wrapFeishuError(e, '操作失败')
    expect(wrapped.code).toBe('230013')
    expect(wrapped.message).toContain('20MB')
  })

  it('飞书错误码 99991401 应映射到"App Secret 错误"', () => {
    const e = { code: '99991401' }
    const wrapped = wrapFeishuError(e, '失败')
    expect(wrapped.code).toBe('99991401')
    expect(wrapped.message).toContain('App Secret')
  })

  it('飞书错误码 99991664 应映射到"权限不足"', () => {
    const e = { code: '99991664' }
    const wrapped = wrapFeishuError(e, '失败')
    expect(wrapped.code).toBe('99991664')
    expect(wrapped.message).toContain('权限')
  })

  it('飞书错误码 230001 应映射到"频率超限"', () => {
    const e = { code: '230001' }
    const wrapped = wrapFeishuError(e, '失败')
    expect(wrapped.code).toBe('230001')
    expect(wrapped.message).toContain('QPS')
  })

  it('未知错误码应使用默认消息', () => {
    const e = { code: '99999999', msg: '原始消息' }
    const wrapped = wrapFeishuError(e, '默认消息')
    expect(wrapped.code).toBe('99999999')
    expect(wrapped.message).toBe('原始消息')
  })

  it('无 code 字段但有 msg 时应返回 msg 内容', () => {
    const e = { msg: 'some error' }
    const wrapped = wrapFeishuError(e, '默认消息')
    expect(wrapped.code).toBe('UNKNOWN')
    expect(wrapped.message).toBe('some error')
  })

  it('普通 Error 应包装为 FeishuApiError', () => {
    const e = new Error('普通错误')
    const wrapped = wrapFeishuError(e, '默认')
    expect(wrapped).toBeInstanceOf(FeishuApiError)
    expect(wrapped.message).toBe('普通错误')
  })

  it('非对象应返回UNKNOWN', () => {
    expect(wrapFeishuError(null, 'null').code).toBe('UNKNOWN')
    expect(wrapFeishuError(undefined, 'undef').code).toBe('UNKNOWN')
  })
})

describe('isPathError', () => {
  it('PATH_FORBIDDEN 错误应返回 true', () => {
    const e = new Error('forbidden')
    e.name = 'PATH_FORBIDDEN'
    expect(isPathError(e)).toBe(true)
  })

  it('普通错误应返回 false', () => {
    expect(isPathError(new Error('normal'))).toBe(false)
  })

  it('null/undefined 应返回 false', () => {
    expect(isPathError(null)).toBe(false)
    expect(isPathError(undefined)).toBe(false)
  })
})

describe('feishuError 辅助函数', () => {
  it('应创建带 code 的 FeishuApiError', () => {
    const err = feishuError('配额不足', '230020')
    expect(err.message).toBe('配额不足')
    expect(err.code).toBe('230020')
  })
})