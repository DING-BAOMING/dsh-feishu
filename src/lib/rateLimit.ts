/**
 * dsh-feishu QPS 限流器
 *
 * ⚠️ P0-6 修复：飞书云盘 API 限制 5 QPS
 *    全局令牌桶，所有 API 调用必须先 acquire()
 *
 * 实现：每 200ms 补充 1 个令牌，上限 5 个
 */

const QPS_LIMIT = 5
const REFILL_INTERVAL_MS = 200  // 每 200ms 补充 1 个令牌

class RateLimiter {
  private tokens: number = QPS_LIMIT
  private lastRefillMs: number = Date.now()
  private queue: Array<() => void> = []

  /**
   * 获取一个令牌（等待可用）
   * 调用方需 await此方法后再发 API 请求
   */
  async acquire(): Promise<void> {
    this.refill()

    if (this.tokens > 0) {
      this.tokens--
      return
    }

    // 等待下一个令牌
    return new Promise<void>((resolve) => {
      this.queue.push(resolve)
      setTimeout(() => {
        this.refill()
        if (this.tokens > 0) {
          this.tokens--
          const next = this.queue.shift()
          if (next) next()
          resolve()
        } else {
          // 重新入队
          this.queue.push(resolve)
        }
      }, REFILL_INTERVAL_MS)
    })
  }

  /** 补充令牌 */
  private refill(): void {
    const now = Date.now()
    const elapsed = now - this.lastRefillMs
    const refillCount = Math.floor(elapsed / REFILL_INTERVAL_MS)
    if (refillCount > 0) {
      this.tokens = Math.min(QPS_LIMIT, this.tokens + refillCount)
      this.lastRefillMs = now
    }
  }

  /** 返回当前可用令牌数（调试用） */
  available(): number {
    this.refill()
    return this.tokens
  }
}

/** 全局单例 */
export const rateLimiter = new RateLimiter()
