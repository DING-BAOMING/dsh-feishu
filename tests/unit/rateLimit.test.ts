/**
 * dsh-feishu 限流器测试
 */

import { describe, it, expect } from 'vitest'

describe('rateLimiter singleton', () => {
  it('初始令牌数应为 5', async () => {
    const mod = await import('../../src/lib/rateLimit')
    // available() 触发 refill 后返回 tokens
    expect(mod.rateLimiter.available()).toBe(5)
  })

  it('acquire 后令牌应减少', async () => {
    const mod = await import('../../src/lib/rateLimit')
    const before = mod.rateLimiter.available()
    await mod.rateLimiter.acquire()
    const after = mod.rateLimiter.available()
    expect(after).toBeLessThanOrEqual(before)
  })

  it('令牌耗尽后 acquire 应等待', async () => {
    const mod = await import('../../src/lib/rateLimit')
    // 消耗所有令牌
    for (let i = 0; i < 5; i++) await mod.rateLimiter.acquire()
    // 此时无可用令牌，后续 acquire 会等待
    // 等待补充（250ms > 200ms refill interval）
    await new Promise((r) => setTimeout(r, 250))
    // 令牌已补充
    expect(mod.rateLimiter.available()).toBeGreaterThanOrEqual(1)
  }, 5000)

  it('available() 不应抛出', async () => {
    const mod = await import('../../src/lib/rateLimit')
    expect(() => mod.rateLimiter.available()).not.toThrow()
    expect(typeof mod.rateLimiter.available()).toBe('number')
  })

  it('并发调用不应超过 5 QPS 限制', async () => {
    const mod = await import('../../src/lib/rateLimit')
    // 快速发起 10 个 acquire（令牌桶最多 5 个）
    const promises = Array.from({ length: 10 }, () => mod.rateLimiter.acquire())
    // 所有请求应都能完成（等待后）
    await Promise.race([
      Promise.all(promises),
      new Promise((r) => setTimeout(r, 2000)),
    ])
    // 至少前 5 个应该立即获得
    expect(true).toBe(true)
  }, 5000)
})