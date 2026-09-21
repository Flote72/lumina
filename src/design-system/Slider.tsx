import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { useT } from '@/i18n'
import { decimalsOf, fillRange, parseInput, snap, valueFromPointer } from '@/core/ui/sliderMath'

export interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  defaultValue?: number
  /** Called continuously while dragging / typing / stepping. */
  onChange: (value: number) => void
  /** Called once when an interaction ends (pointer up, Enter, key step) — use for history entries. */
  onCommit?: (value: number) => void
  /** CSS background for the track (e.g. temperature gradient). */
  trackBackground?: string
  unit?: string
  disabled?: boolean
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  defaultValue = 0,
  onChange,
  onCommit,
  trackBackground,
  unit,
  disabled,
}: SliderProps) {
  const t = useT()
  const labelId = useId()
  const trackRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const dragging = useRef(false)

  const decimals = decimalsOf(step)
  const changed = value !== defaultValue
  const [from, to] = fillRange(value, defaultValue, min, max)
  const thumbPct = ((value - min) / (max - min || 1)) * 100
  const text = `${min < 0 && value > 0 ? '+' : ''}${value.toFixed(decimals)}`

  const set = (v: number, commit = false) => {
    const next = snap(v, min, max, step)
    onChange(next)
    if (commit) onCommit?.(next)
  }

  const fromPointer = (e: PointerEvent) => {
    const r = trackRef.current!.getBoundingClientRect()
    return valueFromPointer(e.clientX, r.left, r.width, min, max, step)
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.focus()
    dragging.current = true
    set(fromPointer(e))
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) set(fromPointer(e))
  }
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    dragging.current = false
    set(fromPointer(e), true)
  }

  const keyStep = (e: KeyboardEvent, base: number): number | null => {
    const big = e.shiftKey ? 10 : 1
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        return base + step * big
      case 'ArrowLeft':
      case 'ArrowDown':
        return base - step * big
      case 'PageUp':
        return base + step * 10
      case 'PageDown':
        return base - step * 10
      default:
        return null
    }
  }

  const onTrackKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    if (e.key === 'Home') return e.preventDefault(), set(min, true)
    if (e.key === 'End') return e.preventDefault(), set(max, true)
    const next = keyStep(e, value)
    if (next !== null) {
      e.preventDefault()
      set(next, true)
    }
  }

  const commitDraft = () => {
    if (draft === null) return
    const n = parseInput(draft)
    setDraft(null)
    if (n !== null) set(n, true)
  }

  const onInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur()
    else if (e.key === 'Escape') {
      setDraft(null)
      e.currentTarget.blur()
    } else {
      const next = keyStep(e, parseInput(draft ?? text) ?? value)
      if (next !== null && !e.key.startsWith('Page')) {
        e.preventDefault()
        set(next, true)
        setDraft(null)
      }
    }
  }

  const fillStyle: CSSProperties = { left: `${from * 100}%`, width: `${(to - from) * 100}%` }

  return (
    <div
      className="grid items-center gap-2 px-3"
      style={{ height: 'var(--spacing-row)', gridTemplateColumns: '84px 1fr 44px', opacity: disabled ? 0.45 : 1 }}
    >
      <span
        id={labelId}
        title={t('slider.reset')}
        onDoubleClick={() => !disabled && set(defaultValue, true)}
        className={`flex min-w-0 cursor-default items-center gap-1.5 truncate text-sm ${changed ? 'text-fg-0' : 'text-fg-1'}`}
      >
        <i
          aria-hidden
          className="inline-block size-1 shrink-0 rounded-full"
          style={{ background: changed ? 'var(--color-accent)' : 'transparent' }}
        />
        <span className="truncate">{label}</span>
      </span>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-labelledby={labelId}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${text}${unit ?? ''}${changed ? `, ${t('slider.changed')}` : ''}`}
        aria-disabled={disabled}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onTrackKey}
        className="group relative h-full cursor-ew-resize touch-none"
      >
        <div
          className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-bg-3"
          style={trackBackground ? { background: trackBackground, height: 4 } : undefined}
        >
          {!trackBackground && (
            <div
              className="absolute inset-y-0 rounded-full"
              style={{ ...fillStyle, background: changed ? 'var(--color-accent)' : 'var(--color-line-strong)' }}
            />
          )}
        </div>
        {/* neutral tick at default position */}
        <div
          aria-hidden
          className="absolute top-1/2 h-[7px] w-px -translate-y-1/2 bg-fg-2/60"
          style={{ left: `${((defaultValue - min) / (max - min || 1)) * 100}%` }}
        />
        <div
          aria-hidden
          className="absolute top-1/2 size-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-bg-0 transition-transform group-hover:scale-110"
          style={{ left: `${thumbPct}%`, background: changed ? 'var(--color-accent)' : 'var(--color-fg-1)' }}
        />
      </div>

      <input
        aria-label={label}
        inputMode="decimal"
        disabled={disabled}
        value={draft ?? text}
        onFocus={(e) => {
          setDraft(text.replace('+', ''))
          e.currentTarget.select()
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={onInputKey}
        className={`h-5 w-full rounded-[3px] border border-transparent bg-transparent px-1 text-right font-mono text-xs tabular-nums hover:bg-bg-2 focus:border-line-strong focus:bg-bg-2 ${changed ? 'text-fg-0' : 'text-fg-1'}`}
      />
    </div>
  )
}
