import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: number
}

/** Minimal accessible modal: Esc / backdrop closes, focus moves inside and returns afterwards. */
export function Modal({ title, onClose, children, footer, width = 380 }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const first = ref.current?.querySelector<HTMLElement>('input,button,select,textarea')
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      } else if (e.key === 'Tab' && ref.current) {
        const f = [...ref.current.querySelectorAll<HTMLElement>('input,button,select,textarea,[tabindex="0"]')].filter((x) => !x.hasAttribute('disabled'))
        if (!f.length) return
        const a = document.activeElement
        if (e.shiftKey && a === f[0]) {
          e.preventDefault()
          f[f.length - 1]!.focus()
        } else if (!e.shiftKey && a === f[f.length - 1]) {
          e.preventDefault()
          f[0]!.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      prev?.focus?.()
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className="max-h-[85vh] overflow-y-auto rounded-md border border-line-strong bg-bg-1 shadow-2xl" style={{ width }}>
        <h2 className="border-b border-line px-4 py-2.5 text-base font-medium">{title}</h2>
        <div className="px-4 py-3">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-4 py-2.5">{footer}</div>}
      </div>
    </div>
  )
}
