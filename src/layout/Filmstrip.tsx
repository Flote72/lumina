import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useT } from '@/i18n'
import { useLibrary, useVisibleIds } from '@/store/library'
import { usePhotos } from '@/store/photos'

/** Horizontal, virtualized strip: only the visible thumbnails exist in the DOM, so thousands of photos stay smooth. */
export function Filmstrip() {
  const t = useT()
  const total = usePhotos((s) => s.order.length)
  const order = useVisibleIds()
  const photos = usePhotos((s) => s.photos)
  const currentId = usePhotos((s) => s.currentId)
  const selection = useLibrary((s) => s.selection)
  const parent = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  useLayoutEffect(() => {
    const el = parent.current
    if (!el) return
    const ro = new ResizeObserver(() => setHeight(el.clientHeight))
    setHeight(el.clientHeight)
    ro.observe(el)
    return () => ro.disconnect()
  }, [total])

  const itemH = Math.max(24, height - 12)
  const widthOf = (id: string | undefined) => {
    const p = id ? photos[id] : undefined
    return itemH * (p && p.width && p.height ? p.width / p.height : 1.5)
  }
  const v = useVirtualizer({
    horizontal: true,
    count: order.length,
    getScrollElement: () => parent.current,
    estimateSize: (i) => widthOf(order[i]),
    gap: 6,
    paddingStart: 8,
    paddingEnd: 8,
    overscan: 8,
  })
  useEffect(() => v.measure(), [v, itemH, order])

  useEffect(() => {
    const i = currentId ? order.indexOf(currentId) : -1
    if (i >= 0) v.scrollToIndex(i, { align: 'auto' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId])

  if (total === 0) {
    return (
      <div role="region" aria-label={t('filmstrip.title')} className="flex h-full items-center justify-center bg-bg-1 text-xs text-fg-2">
        {t('filmstrip.empty')}
      </div>
    )
  }
  const sel = new Set(selection)
  return (
    <div ref={parent} role="listbox" aria-label={t('filmstrip.title')} className="h-full overflow-x-auto overflow-y-hidden bg-bg-1">
      <div style={{ width: v.getTotalSize(), height: '100%', position: 'relative' }}>
        {v.getVirtualItems().map((item) => {
          const id = order[item.index]!
          const p = photos[id]
          if (!p) return null
          const current = id === currentId
          return (
            <button
              key={id}
              role="option"
              aria-selected={current}
              aria-label={`${t('filmstrip.select')}: ${p.name}`}
              title={p.name}
              onClick={(e) => useLibrary.getState().click(id, order, { shift: e.shiftKey, toggle: e.metaKey || e.ctrlKey })}
              className={`absolute top-1.5 overflow-hidden rounded-[3px] border bg-bg-0 ${current ? 'border-accent' : sel.has(id) ? 'border-accent/50' : 'border-line hover:border-line-strong'}`}
              style={{ left: 0, transform: `translateX(${item.start}px)`, width: item.size, height: itemH }}
            >
              {p.thumbUrl && <img src={p.thumbUrl} alt="" draggable={false} loading="lazy" className="size-full object-cover" />}
              {p.status === 'loading' && <span className="absolute inset-0 animate-pulse bg-bg-2" />}
              {p.status === 'error' && <span className="absolute inset-0 flex items-center justify-center bg-bg-2 text-danger">!</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
