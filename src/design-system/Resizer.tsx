import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { useT } from '@/i18n'

interface Props {
  axis: 'x' | 'y'
  /** Current size of the panel being resized, in px. */
  size: number
  min: number
  max: number
  /** true when dragging toward +axis should shrink the panel (right panel, filmstrip). */
  invert?: boolean
  onResize: (px: number) => void
  onReset: () => void
}

export function Resizer({ axis, size, min, max, invert, onResize, onReset }: Props) {
  const t = useT()
  const start = useRef<{ pos: number; size: number } | null>(null)
  const sign = invert ? -1 : 1
  const pos = (e: PointerEvent) => (axis === 'x' ? e.clientX : e.clientY)

  const onKey = (e: KeyboardEvent) => {
    const grow = axis === 'x' ? 'ArrowRight' : 'ArrowDown'
    const shrink = axis === 'x' ? 'ArrowLeft' : 'ArrowUp'
    if (e.key !== grow && e.key !== shrink) return
    e.preventDefault()
    const d = (e.shiftKey ? 40 : 10) * (e.key === grow ? 1 : -1) * sign
    onResize(size + d)
  }

  return (
    <div
      role="separator"
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      aria-label={t('panel.resize')}
      aria-valuenow={size}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        start.current = { pos: pos(e), size }
      }}
      onPointerMove={(e) => {
        if (start.current) onResize(start.current.size + (pos(e) - start.current.pos) * sign)
      }}
      onPointerUp={() => (start.current = null)}
      onPointerCancel={() => (start.current = null)}
      onKeyDown={onKey}
      onDoubleClick={onReset}
      className={`group relative z-10 shrink-0 touch-none ${axis === 'x' ? 'w-px cursor-col-resize bg-line' : 'h-px cursor-row-resize bg-line'}`}
    >
      {/* wider invisible hit area */}
      <div className={`absolute ${axis === 'x' ? '-inset-x-1.5 inset-y-0' : '-inset-y-1.5 inset-x-0'} group-hover:bg-accent/25 group-active:bg-accent/40`} />
    </div>
  )
}
