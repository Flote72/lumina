import { useEffect, useRef } from 'react'
import { useT } from '@/i18n'
import { usePhotos } from '@/store/photos'

export function Filmstrip() {
  const t = useT()
  const order = usePhotos((s) => s.order)
  const photos = usePhotos((s) => s.photos)
  const currentId = usePhotos((s) => s.currentId)
  const select = usePhotos((s) => s.select)
  const cur = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cur.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [currentId])

  if (order.length === 0) {
    return (
      <div role="region" aria-label={t('filmstrip.title')} className="flex h-full items-center justify-center bg-bg-1 text-xs text-fg-2">
        {t('filmstrip.empty')}
      </div>
    )
  }
  return (
    <div role="listbox" aria-label={t('filmstrip.title')} className="flex h-full items-center gap-1.5 overflow-x-auto overflow-y-hidden bg-bg-1 px-2">
      {order.map((id) => {
        const p = photos[id]!
        const sel = id === currentId
        return (
          <button
            key={id}
            ref={sel ? cur : undefined}
            role="option"
            aria-selected={sel}
            aria-label={`${t('filmstrip.select')}: ${p.name}`}
            title={p.name}
            onClick={() => select(id)}
            className={`relative h-[calc(100%-12px)] shrink-0 overflow-hidden rounded-[3px] border bg-bg-0 ${sel ? 'border-accent' : 'border-line hover:border-line-strong'}`}
            style={{ aspectRatio: p.width && p.height ? `${p.width} / ${p.height}` : '3 / 2' }}
          >
            {p.thumbUrl && <img src={p.thumbUrl} alt="" draggable={false} className="size-full object-cover" />}
            {p.status === 'loading' && <span className="absolute inset-0 animate-pulse bg-bg-2" />}
            {p.status === 'error' && <span className="absolute inset-0 flex items-center justify-center bg-bg-2 text-danger">!</span>}
          </button>
        )
      })}
    </div>
  )
}
