/**
 * dsh-feishu QPS 限流器
 *
 * 飞书云盘 API 限制 5 QPS
 * 全局令牌桶，所有 API 调用必须先 acquire()
 * 实现：每 200ms 补充 1 个令牌，上限 5 个
 */

const QPS_LIMIT = 5
const REFILL_INTERVAL_MS = 200  // ponytail: 全局锁，吞吐量足够；per-account 锁在需要时升级
const MAX_QUEUE_SIZE = 1000   // 队列上限，防止内存溢出

export class RateLimiter {
  private tokens: number = QPS_LIMIT
  private lastRefillMs: number = Date.now()
  private queue: Array<() => void> = []

  /**
   * 获取一个令牌（等待可用）
   * 调用方需 await 此方法后再发 API 请求
   * @throws Error 如果队列已满（超过 MAX_QUEUE_SIZE）
   */
  async acquire(): Promise<void> {
    this.refill()

    if (this.tokens > 0) {
      this.tokens--
      return
    }

    if (this.queue.length >= MAX_QUEUE_SIZE) {
      throw new Error(`RateLimiter queue overflow: ${MAX_QUEUE_SIZE} requests pending`)
    }

    return new Promise<void>((resolve) => {
      this.queue.push(resolve)
      setTimeout(() => {
        this.refill()
        if (this.tokens > 0) {
          this.tokens--
          const next = this.queue.shift()
          if (next) next()
          resolve()
        } else if (this.queue.length > 0) {
          this.queue.shift()?.()
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

  /** 返回队列长度（调试用） */
  pending(): number {
    return this.queue.length
  }
}

/** 全局单例 */
export const rateLimiter = new RateLimiter()
