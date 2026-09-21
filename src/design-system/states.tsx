import type { ReactNode } from 'react'
import { useT } from '@/i18n'
import { AlertIcon, ImageIcon } from './icons'

export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin text-fg-2" role="status" aria-label="loading">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.4" opacity="0.25" />
      <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="var(--color-accent)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

export function LoadingState({ label }: { label?: string }) {
  const t = useT()
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-fg-2">
      <Spinner size={24} />
      <span className="text-sm">{label ?? t('loading')}</span>
    </div>
  )
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <ImageIcon className="text-line-strong" />
      <h2 className="mt-1 text-base font-medium text-fg-0">{title}</h2>
      {body && <p className="max-w-sm text-sm text-fg-2">{body}</p>}
      {action && <div className="mt-2 flex flex-col items-center gap-1.5">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useT()
  const msg = error instanceof Error ? error.message : String(error)
  return (
    <div role="alert" className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <AlertIcon width={28} height={28} className="text-danger" />
      <h2 className="text-base font-medium">{t('error.title')}</h2>
      <p className="max-w-md font-mono text-xs break-words text-fg-2">{msg}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 h-6 rounded-[4px] border border-line bg-bg-2 px-3 text-sm hover:bg-bg-3"
        >
          {t('error.retry')}
        </button>
      )}
    </div>
  )
}
