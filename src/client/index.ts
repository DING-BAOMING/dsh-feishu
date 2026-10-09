// @ts-nocheck
/**
 * dsh-feishu-cloud client entry
 * Registers Settings Card for Feishu connection config + setup tutorial
 */

import { h, useState, useEffect, useCallback } from 'react'

export const inject = ['slots', 'locale', 'credentials'] as const

export function apply(ctx) {
  ctx.slots.inject('settings.section', () => {
    ctx.slots.register(
      { name: 'settings.section', id: 'dsh-feishu-cloud', order: 500, label: 'Feishu Connection' },
      () => h(FeishuSettings, { ctx }),
    )
  })
}

const STR = {
  'zh-CN': {
    title: 'Feishu Connection',
    statusConnected: 'Connected',
    statusDisconnected: 'Not Connected',
    appId: 'App ID',
    appIdPlaceholder: 'Feishu App ID',
    appSecret: 'App Secret',
    appSecretPlaceholder: 'Feishu App Secret (stored securely)',
    verifyBtn: 'Verify',
    verifying: 'Verifying...',
    tutorialToggle: 'No Feishu app? Setup guide',
    step1: 'Step 1: Create Feishu App',
    step1Desc: 'Open {url}, click Create self-built app',
    step2: 'Step 2: Enable cloud drive permission',
    step2Desc: 'App > Permissions > enable drive:file',
    step3: 'Step 3: Get credentials',
    step3Desc: 'Credentials page > copy App ID + App Secret',
    step4: 'Step 4: Paste credentials',
    step4Desc: 'Fill in above and click Verify',
    enterpriseNote: 'Enterprise: permissions need admin approval',
    connectedAs: 'Connected as {name}',
    noSecret: 'Please enter App Secret',
    wrongSecret: 'App ID or App Secret incorrect',
    permissionDenied: 'Permission denied - check drive:file permission',
    networkError: 'Network error',
    unknownError: 'Error: {msg}',
    openFeishu: 'Open Feishu Console',
    storageUsed: 'Storage: {used} / {total}',
    storageQuota: 'Storage Quota',
  },
  en: {
    title: 'Feishu Connection',
    statusConnected: 'Connected',
    statusDisconnected: 'Not Connected',
    appId: 'App ID',
    appIdPlaceholder: 'Feishu App ID',
    appSecret: 'App Secret',
    appSecretPlaceholder: 'Feishu App Secret (stored securely)',
    verifyBtn: 'Verify',
    verifying: 'Verifying...',
    tutorialToggle: 'No Feishu app? Setup guide',
    step1: 'Step 1: Create Feishu App',
    step1Desc: 'Open {url}, click Create self-built app',
    step2: 'Step 2: Enable cloud drive permission',
    step2Desc: 'App > Permissions > enable drive:file',
    step3: 'Step 3: Get credentials',
    step3Desc: 'Credentials page > copy App ID + App Secret',
    step4: 'Step 4: Paste credentials',
    step4Desc: 'Fill in above and click Verify',
    enterpriseNote: 'Enterprise: permissions need admin approval',
    connectedAs: 'Connected as {name}',
    noSecret: 'Please enter App Secret',
    wrongSecret: 'App ID or App Secret incorrect',
    permissionDenied: 'Permission denied - check drive:file permission',
    networkError: 'Network error',
    unknownError: 'Error: {msg}',
    openFeishu: 'Open Feishu Console',
    storageUsed: 'Storage: {used} / {total}',
    storageQuota: 'Storage Quota',
  },
}

function t(locale, key, vars) {
  const str = (STR[locale] && STR[locale][key]) || STR.en[key] || key
  if (!vars) return str
  return Object.entries(vars).reduce((s, [k, v]) => s.replace('{' + k + '}', String(v)), str)
}

const css = '.fc-root{font-family:Inter,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;font-size:14px;color:#212529}.fc-card{background:#fff;border:1px solid #dee2e6;border-radius:8px;overflow:hidden}.fc-header{padding:16px 20px;border-bottom:1px solid #dee2e6;display:flex;align-items:center;justify-content:space-between}.fc-title{font-size:16px;font-weight:600;color:#212529;margin:0;display:flex;align-items:center;gap:8px}.fc-icon{width:24px;height:24px;border-radius:4px;background:#4C6EF5;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;flex-shrink:0}.fc-status{padding:12px 20px;background:#f8f9fa;display:flex;align-items:center;gap:8px}.fc-status-dot{width:8px;height:8px;border-radius:50%}.fc-status-dot.ok{background:#37A169}.fc-status-dot.err{background:#C92A2A}.fc-form{padding:20px;display:flex;flex-direction:column;gap:16px}.fc-row{display:flex;gap:12px}.fc-field{flex:1;display:flex;flex-direction:column;gap:4px}.fc-label{font-size:12px;font-weight:500;color:#495057}.fc-input{padding:8px 12px;border:1px solid #ced4da;border-radius:6px;font-size:14px;outline:none;transition:border-color .15s,box-shadow .15s}.fc-input:focus{border-color:#4C6EF5;box-shadow:0 0 0 3px rgba(76,110,245,.15)}.fc-input-secret{font-family:monospace;letter-spacing:1px}.fc-btn{padding:8px 16px;border-radius:6px;font-size:14px;font-weight:500;cursor:pointer;border:none;transition:background .15s,opacity .15s;display:inline-flex;align-items:center;gap:6px}.fc-btn:disabled{opacity:.6;cursor:not-allowed}.fc-btn-primary{background:#4C6EF5;color:#fff}.fc-btn-primary:hover:not(:disabled){background:#364FC7}.fc-btn-secondary{background:#e9ecef;color:#495057}.fc-btn-secondary:hover:not(:disabled){background:#dee2e6}.fc-error{padding:12px 16px;background:#fff5f5;border:1px solid #ffc9c9;border-radius:6px;color:#C92A2A;font-size:13px}.fc-quota{padding:12px 20px;border-top:1px solid #dee2e6;display:flex;flex-direction:column;gap:6px}.fc-quota-label{font-size:12px;color:#868e96;display:flex;justify-content:space-between}.fc-quota-bar{height:6px;background:#e9ecef;border-radius:3px;overflow:hidden}.fc-quota-fill{height:100%;background:#4C6EF5;border-radius:3px;transition:width .3s}.fc-accordion{border-top:1px solid #dee2e6}.fc-accordion-header{padding:12px 20px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;user-select:none;font-size:13px;color:#495057;background:#fff}.fc-accordion-header:hover{background:#f8f9fa}.fc-accordion-body{padding:16px 20px;background:#f8f9fa;display:flex;flex-direction:column;gap:16px}.fc-step{display:flex;flex-direction:column;gap:4px}.fc-step-title{font-size:13px;font-weight:600;color:#212529}.fc-step-desc{font-size:12px;color:#495057;line-height:1.5}.fc-step-url{color:#4C6EF5;text-decoration:none}.fc-step-url:hover{text-decoration:underline}.fc-note{font-size:12px;color:#E67700;background:#fffbf0;padding:8px 12px;border-radius:6px;border:1px solid #ffc9c9}.fc-btns{display:flex;gap:8px}'

let stylesInjected = false
function injectStyles() {
  if (stylesInjected || document.getElementById('dsh-feishu-cloud-styles')) { stylesInjected = true; return }
  const el = document.createElement('style')
  el.id = 'dsh-feishu-cloud-styles'
  el.textContent = css
  document.head.appendChild(el)
  stylesInjected = true
}

function FeishuSettings({ ctx }) {
  const locale = ctx.locale === 'en' ? 'en' : 'zh-CN'

  const [appId, setAppId] = useState('')
  const [appSecret, setAppSecret] = useState('')
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')
  const [showTutorial, setShowTutorial] = useState(false)
  const [quota, setQuota] = useState({})

  useEffect(() => {
    injectStyles()
    ctx.config.get('appId').then(v => { if (v) setAppId(v) })
    ctx.credentials.get('dsh-feishu-cloud.appSecret').then(v => { if (v) setAppSecret(v) })
  }, [ctx])

  const handleAppIdChange = useCallback(e => {
    const v = e.target.value
    setAppId(v)
    ctx.config.set('appId', v).catch(() => {})
  }, [ctx])

  const handleAppSecretChange = useCallback(e => setAppSecret(e.target.value), [])

  const handleVerify = useCallback(async () => {
    if (!appSecret) { setError(t(locale, 'noSecret')); return }
    setConnecting(true)
    setError('')
    try {
      await ctx.credentials.set('dsh-feishu-cloud.appSecret', appSecret)
      const toolFn = (window.__DSH_TOOL__ || window.__DSH_TOOLS__)
      let resp
      if (typeof toolFn === 'function') {
        resp = await toolFn('feishu_verify_connection', { appId, appSecret })
      } else {
        resp = { success: false, message: 'Tool API not available' }
      }
      if (resp.success) {
        setConnected(true)
        setError('')
        if (resp.quota) setQuota(resp.quota)
      } else {
        setConnected(false)
        setError(resp.message || t(locale, 'wrongSecret'))
      }
    } catch (err) {
      const msg = err && err.message ? err.message : String(err)
      setConnected(false)
      if (msg.includes('99991401') || msg.includes('invalid')) {
        setError(t(locale, 'wrongSecret'))
      } else if (msg.includes('permission') || msg.includes('403')) {
        setError(t(locale, 'permissionDenied'))
      } else if (msg.includes('network') || msg.includes('fetch')) {
        setError(t(locale, 'networkError'))
      } else {
        setError(t(locale, 'unknownError', { msg }))
      }
    } finally {
      setConnecting(false)
    }
  }, [appId, appSecret, ctx, locale])

  const handleSaveSecret = useCallback(() => {
    if (appSecret) ctx.credentials.set('dsh-feishu-cloud.appSecret', appSecret).catch(() => {})
  }, [appSecret, ctx])

  const formatBytes = (bytes) => {
    if (!bytes && bytes !== 0) return '-'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
  }

  const quotaPct = quota.total ? Math.min(100, ((quota.used || 0) / quota.total) * 100) : 0

  return h('div', { className: 'fc-root' },
    h('div', { className: 'fc-card' },
      h('div', { className: 'fc-header' },
        h('div', { className: 'fc-title' },
          h('div', { className: 'fc-icon' }, 'F'),
          h('span', null, t(locale, 'title')),
        ),
        connected
          ? h('span', { style: { fontSize: '12px', color: '#37A169', fontWeight: 500 } }, t(locale, 'statusConnected'))
          : h('span', { style: { fontSize: '12px', color: '#868e96' } }, t(locale, 'statusDisconnected'))
      ),
      h('div', { className: 'fc-status' },
        h('div', { className: 'fc-status-dot ' + (connected ? 'ok' : 'err') }),
        h('span', { style: { fontSize: '13px', color: '#495057' } },
          connected ? t(locale, 'connectedAs', { name: quota.name || 'Feishu User' }) : t(locale, 'statusDisconnected')
        ),
      ),
      connected && quota.total
        ? h('div', { className: 'fc-quota' },
            h('div', { className: 'fc-quota-label' },
              h('span', null, t(locale, 'storageQuota')),
              h('span', null, t(locale, 'storageUsed', { used: formatBytes(quota.used), total: formatBytes(quota.total) })),
            ),
            h('div', { className: 'fc-quota-bar' },
              h('div', { className: 'fc-quota-fill', style: { width: quotaPct + '%' } }),
            ),
          )
        : null,
      h('div', { className: 'fc-form' },
        h('div', { className: 'fc-row' },
          h('div', { className: 'fc-field' },
            h('label', { className: 'fc-label', htmlFor: 'fc-appid' }, t(locale, 'appId')),
            h('input', {
              id: 'fc-appid', className: 'fc-input', type: 'text',
              placeholder: t(locale, 'appIdPlaceholder'),
              value: appId, onChange: handleAppIdChange,
              autocomplete: 'off', spellcheck: false,
            }),
          ),
          h('div', { className: 'fc-field' },
            h('label', { className: 'fc-label', htmlFor: 'fc-secret' }, t(locale, 'appSecret')),
            h('input', {
              id: 'fc-secret', className: 'fc-input fc-input-secret', type: 'password',
              placeholder: t(locale, 'appSecretPlaceholder'),
              value: appSecret, onChange: handleAppSecretChange,
              onBlur: handleSaveSecret, autocomplete: 'off',
            }),
          ),
        ),
        h('div', { className: 'fc-btns' },
          h('button', {
            className: 'fc-btn fc-btn-primary',
            onClick: handleVerify,
            disabled: connecting || !appId || !appSecret,
          }, connecting ? t(locale, 'verifying') : t(locale, 'verifyBtn')),
        ),
        error ? h('div', { className: 'fc-error', role: 'alert' }, error) : null,
      ),
      h('div', { className: 'fc-accordion' },
        h('div', {
          className: 'fc-accordion-header',
          onClick: () => setShowTutorial(v => !v),
          role: 'button', tabIndex: 0,
          onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') setShowTutorial(v => !v) },
        },
          h('span', null, '? ' + t(locale, 'tutorialToggle')),
          h('span', { style: { transform: showTutorial ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'inline-block' } }, '>')
        ),
        showTutorial
          ? h('div', { className: 'fc-accordion-body' },
              h('div', { className: 'fc-step' },
                h('div', { className: 'fc-step-title' }, t(locale, 'step1')),
                h('div', { className: 'fc-step-desc' },
                  t(locale, 'step1Desc', { url: '' }),
                  ' ',
                  h('a', { className: 'fc-step-url', href: 'https://open.feishu.cn/app', target: '_blank', rel: 'noopener noreferrer' }, t(locale, 'openFeishu')),
                ),
              ),
              h('div', { className: 'fc-step' },
                h('div', { className: 'fc-step-title' }, t(locale, 'step2')),
                h('div', { className: 'fc-step-desc' }, t(locale, 'step2Desc')),
              ),
              h('div', { className: 'fc-step' },
                h('div', { className: 'fc-step-title' }, t(locale, 'step3')),
                h('div', { className: 'fc-step-desc' }, t(locale, 'step3Desc')),
              ),
              h('div', { className: 'fc-step' },
                h('div', { className: 'fc-step-title' }, t(locale, 'step4')),
                h('div', { className: 'fc-step-desc' }, t(locale, 'step4Desc')),
              ),
              h('div', { className: 'fc-note' }, '! ' + t(locale, 'enterpriseNote')),
            )
          : null,
      ),
    ),
  )
}
