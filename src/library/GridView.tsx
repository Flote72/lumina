import { useVirtualizer } from '@tanstack/react-virtual'
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { EmptyState } from '@/design-system/states'
import { Button } from '@/design-system/Button'
import { filtersActive } from '@/core/library/filter'
import { useT } from '@/i18n'
import { useLibrary, useVisibleIds } from '@/store/library'
import { usePhotos } from '@/store/photos'
import { importFromFiles, importFromFolder } from './importActions'
import { LABEL_COLOR } from './labelColors'
import { FlagBadge, Stars } from './PhotoBits'

interface CellProps {
  id: string
  size: number
  selected: boolean
  active: boolean
  onClick: (id: string, e: React.MouseEvent) => void
  onOpen: (id: string) => void
}

const Cell = memo(function Cell({ id, size, selected, active, onClick, onOpen }: CellProps) {
  const p = usePhotos((s) => s.photos[id])
  if (!p) return null
  return (
    <div style={{ width: size, height: size }} className="p-[3px]">
      <div
        role="option"
        aria-selected={selected}
        aria-label={p.name}
        tabIndex={-1}
        data-photo-id={id}
        onClick={(e) => onClick(id, e)}
        onDoubleClick={() => onOpen(id)}
        className={`group relative size-full cursor-default overflow-hidden rounded-[3px] bg-bg-1 ${selected ? (active ? 'outline-2 outline-accent' : 'outline-2 outline-accent/50') : 'hover:outline hover:outline-line-strong'}`}
        style={{ outlineOffset: -2 }}
      >
        {p.thumbUrl ? <img src={p.thumbUrl} alt="" loading="lazy" draggable={false} className="size-full object-contain" /> : <div className="size-full animate-pulse bg-bg-2" />}
        {p.status === 'error' && <span className="absolute inset-0 flex items-center justify-center bg-bg-2 text-danger">!</span>}
        {p.label !== 'none' && <span className="absolute top-0 right-0 left-0 h-[3px]" style={{ background: LABEL_COLOR[p.label] }} />}
        <div className="pointer-events-none absolute right-0 bottom-0 left-0 flex items-end justify-between bg-gradient-to-t from-black/70 to-transparent px-1.5 pt-4 pb-1 opacity-0 transition-opacity group-hover:opacity-100 group-aria-selected:opacity-100">
          <Stars value={p.rating} size={Math.max(9, Math.min(13, size / 14))} />
          <span className="flex items-center gap-1">
            {p.hasEdits && <span className="text-[10px] text-accent" title="Edited">◐</span>}
            <FlagBadge flag={p.flag} />
          </span>
        </div>
        {size >= 150 && <span className="pointer-events-none absolute top-1 left-1.5 max-w-[80%] truncate rounded-[2px] bg-black/55 px-1 text-[10px] text-white/85 opacity-0 group-hover:opacity-100">{p.name}</span>}
      </div>
    </div>
  )
})

export function GridView() {
  const t = useT()
  const ids = useVisibleIds()
  const total = usePhotos((s) => s.order.length)
  const size = useLibrary((s) => s.thumbSize)
  const selection = useLibrary((s) => s.selection)
  const filters = useLibrary((s) => s.filters)
  const coll = useLibrary((s) => s.activeCollection)
  const currentId = usePhotos((s) => s.currentId)
  const setView = useLibrary((s) => s.setView)
  const parent = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const el = parent.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    setWidth(el.clientWidth)
    ro.observe(el)
    return () => ro.disconnect()
  }, [total])

  const cols = Math.max(1, Math.floor(width / size))
  const cell = width / cols
  const rows = Math.ceil(ids.length / cols)
  const v = useVirtualizer({ count: rows, getScrollElement: () => parent.current, estimateSize: () => cell, overscan: 4 })
  useEffect(() => v.measure(), [v, cell])

  // keep the active photo in view when it changes (arrow keys / filmstrip)
  useEffect(() => {
    const i = currentId ? ids.indexOf(currentId) : -1
    if (i >= 0 && cols) v.scrollToIndex(Math.floor(i / cols), { align: 'auto' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, cols])

  // Up/Down move by a row; Left/Right handled globally
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
      const el = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.closest('[role="slider"]')) return
      const cur = usePhotos.getState().currentId
      const i = cur ? ids.indexOf(cur) : -1
      const next = ids[i + (e.key === 'ArrowDown' ? cols : -cols)]
      if (next) {
        e.preventDefault()
        useLibrary.getState().click(next, ids, { shift: e.shiftKey })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ids, cols])

  const onClick = (id: string, e: React.MouseEvent) => useLibrary.getState().click(id, ids, { shift: e.shiftKey, toggle: e.metaKey || e.ctrlKey })
  const onOpen = (id: string) => {
    usePhotos.getState().select(id)
    setView('loupe')
  }

  if (total === 0) {
    return (
      <EmptyState
        title={t('empty.library.title')}
        body={t('empty.library.body')}
        action={
          <div className="flex gap-2">
            <Button variant="primary" onClick={importFromFiles}>
              {t('import.files')}
            </Button>
            <Button onClick={importFromFolder}>{t('import.folder')}</Button>
          </div>
        }
      />
    )
  }
  if (ids.length === 0) {
    const inColl = !!coll && !filtersActive(filters)
    return (
      <EmptyState
        title={inColl ? t('lib.collectionEmpty') : t('lib.noResults')}
        body={inColl ? t('lib.collectionEmptyBody') : t('lib.noResultsBody')}
        action={filtersActive(filters) && <Button onClick={() => useLibrary.getState().resetFilters()}>{t('lib.filtersReset')}</Button>}
      />
    )
  }

  const sel = new Set(selection)
  return (
    <div ref={parent} role="listbox" aria-multiselectable="true" aria-label={t('module.library')} className="h-full overflow-y-auto" onClick={(e) => e.target === e.currentTarget && useLibrary.getState().setSelection([])}>
      <div style={{ height: v.getTotalSize(), position: 'relative' }}>
        {v.getVirtualItems().map((row) => (
          <div key={row.key} className="absolute top-0 left-0 flex" style={{ transform: `translateY(${row.start}px)`, height: cell, width: '100%' }}>
            {ids.slice(row.index * cols, row.index * cols + cols).map((id) => (
              <Cell key={id} id={id} size={cell} selected={sel.has(id)} active={id === currentId} onClick={onClick} onOpen={onOpen} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
