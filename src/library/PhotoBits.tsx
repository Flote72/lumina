import { useEffect, useState } from 'react'
import type { Flag } from '@/catalog/db'
import { usePhotos } from '@/store/photos'

export function Stars({ value, onChange, size = 12 }: { value: number; onChange?: (n: number) => void; size?: number }) {
  return (
    <span className="inline-flex" role={onChange ? 'radiogroup' : undefined} aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= value
        const star = (
          <span style={{ fontSize: size, lineHeight: 1, color: on ? 'var(--color-accent)' : 'var(--color-line-strong)' }} aria-hidden>
            ★
          </span>
        )
        return onChange ? (
          <button key={n} type="button" role="radio" aria-checked={n === value} aria-label={`${n}`} className="px-px" onClick={() => onChange(n === value ? 0 : n)}>
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        )
      })}
    </span>
  )
}

export function FlagBadge({ flag }: { flag: Flag }) {
  if (flag === 'none') return null
  return (
    <span
      className="rounded-[2px] px-1 text-[10px] leading-4 font-semibold"
      style={flag === 'pick' ? { background: '#f0f0f0', color: '#111' } : { background: '#3a3a3a', color: '#e5544a' }}
      title={flag}
    >
      {flag === 'pick' ? '⚑' : '✕'}
    </span>
  )
}

/**
 * Shows the original (full resolution) for large views. Falls back to the thumbnail while loading.
 * The object URL is revoked on unmount so decoded originals never accumulate.
 */
export function OriginalImage({ id, className = '' }: { id: string; className?: string }) {
  const thumb = usePhotos((s) => s.photos[id]?.thumbUrl ?? null)
  const [big, setBig] = useState<{ id: string; url: string } | null>(null)

  useEffect(() => {
    let url: string | null = null
    let cancelled = false
    usePhotos
      .getState()
      .getFile(id)
      .then((f) => {
        if (cancelled) return
        url = URL.createObjectURL(f)
        setBig({ id, url })
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [id])

  const src = big && big.id === id ? big.url : thumb
  return src ? <img src={src} alt="" draggable={false} className={`object-contain ${className}`} /> : null
}
