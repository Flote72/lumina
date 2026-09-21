import { useToastStore } from '@/store/toast'

export function Toasts() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-3 bottom-3 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex items-start gap-2 rounded-[4px] border bg-bg-2 px-3 py-2 text-sm shadow-lg ${t.kind === 'error' ? 'border-danger/60' : 'border-line-strong'}`}
        >
          <span className="flex-1 text-fg-0">{t.text}</span>
          <button className="text-fg-2 hover:text-fg-0" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
