/**
 * dsh-feishu 客户端入口 — Settings Card 注册
 *
 * 将插件注入 DSH 设置页的插件列表中
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'

export const inject = ['slots', 'locale', 'settingsScope'] as const

export function apply(ctx: ClientContext): void {
  // 注册 settings 卡片的 tab 条目
  ctx.slots.inject('settings.plugin.item', () =>
    ctx.slots.register(
      {
        name: 'settings.plugin.item',
        key: 'dsh-feishu',
        locale: 'settings.dshFeishu',
        // 动态加载 React 卡片组件（延迟加载）
        inject: () => ({
          type: 'div',
          children: '飞书插件（加载中...）',
        }),
      },
      null // 实际组件由 FeishuCard.tsx 提供，这里是 stub
    )
  )
}
