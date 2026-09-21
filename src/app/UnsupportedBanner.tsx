import { useState } from 'react'
import { useT } from '@/i18n'
import { detectCapabilities } from '@/platform/capabilities'

export function UnsupportedBanner() {
  const t = useT()
  const [dismissed, setDismissed] = useState(false)
  const caps = detectCapabilities()
  const issues = [!caps.webgl2 && t('unsupported.webgl2'), caps.webgl2 && !caps.floatRenderTarget && t('unsupported.float')].filter(Boolean)
  if (dismissed || issues.length === 0) return null
  return (
    <div role="alert" className="flex items-start gap-3 border-b border-line bg-bg-2 px-3 py-2 text-sm">
      <div className="flex-1">
        <strong className="font-medium text-accent">{t('unsupported.title')}</strong>
        <ul className="mt-0.5 text-fg-1">
          {issues.map((m) => (
            <li key={String(m)}>{m}</li>
          ))}
        </ul>
        <p className="text-fg-2">{t('unsupported.hint')}</p>
      </div>
      <button className="text-fg-2 hover:text-fg-0" onClick={() => setDismissed(true)}>
        {t('unsupported.dismiss')}
      </button>
    </div>
  )
}
