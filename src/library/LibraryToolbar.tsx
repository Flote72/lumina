import { useMemo, useState } from 'react'
import { Button } from '@/design-system/Button'
import { Modal } from '@/design-system/Modal'
import type { ColorLabel } from '@/catalog/db'
import { distinct, filtersActive, type SortKey } from '@/core/library/filter'
import { useT, type TKey } from '@/i18n'
import { LABELS, useLibrary, useVisibleIds, targetIds, type ViewMode } from '@/store/library'
import { usePhotos } from '@/store/photos'
import { LABEL_COLOR } from './labelColors'
import { Stars } from './PhotoBits'

const VIEWS: { id: ViewMode; key: TKey }[] = [
  { id: 'grid', key: 'lib.grid' },
  { id: 'loupe', key: 'lib.loupe' },
  { id: 'compare', key: 'lib.compare' },
  { id: 'survey', key: 'lib.survey' },
]
const SORTS: SortKey[] = ['capture', 'name', 'rating', 'added']
const field = 'h-6 rounded-[4px] border border-line bg-bg-2 px-1.5 text-sm text-fg-0'

const toMs = (v: string, end = false) => (v ? new Date(`${v}T${end ? '23:59:59' : '00:00:00'}`).getTime() : null)
const fromMs = (n: number | null) => (n === null ? '' : new Date(n - new Date(n).getTimezoneOffset() * 60000).toISOString().slice(0, 10))

function FilterPanel() {
  const t = useT()
  const f = useLibrary((s) => s.filters)
  const set = useLibrary((s) => s.setFilters)
  const photos = usePhotos((s) => s.photos)
  const cams = useMemo(() => distinct(Object.values(photos).map((p) => p.camera)), [photos])
  const lenses = useMemo(() => distinct(Object.values(photos).map((p) => p.lens)), [photos])
  const kws = useMemo(() => distinct(Object.values(photos).flatMap((p) => p.keywords)), [photos])
  const lbl = 'flex items-center gap-1.5 text-xs text-fg-2'

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-bg-1 px-3 py-2">
      <span className={lbl}>
        {t('lib.minRating')}
        <Stars value={f.minRating} onChange={(n) => set({ minRating: n })} size={14} />
      </span>
      <label className={lbl}>
        {t('lib.flag')}
        <select className={field} value={f.flag} onChange={(e) => set({ flag: e.target.value as typeof f.flag })}>
          {(['any', 'pick', 'reject', 'none'] as const).map((k) => (
            <option key={k} value={k}>
              {t(`lib.flag.${k}` as TKey)}
            </option>
          ))}
        </select>
      </label>
      <span className={lbl}>
        {t('lib.label')}
        {LABELS.map((l: ColorLabel) => {
          const on = f.labels.includes(l)
          return (
            <button
              key={l}
              type="button"
              aria-pressed={on}
              aria-label={t(`lib.label.${l}` as TKey)}
              title={t(`lib.label.${l}` as TKey)}
              onClick={() => set({ labels: on ? f.labels.filter((x) => x !== l) : [...f.labels, l] })}
              className="size-4 rounded-[3px] border"
              style={{ background: LABEL_COLOR[l as Exclude<ColorLabel, 'none'>], opacity: on ? 1 : 0.35, borderColor: on ? '#fff' : 'transparent' }}
            />
          )
        })}
      </span>
      <label className={lbl}>
        {t('lib.camera')}
        <select className={`${field} max-w-40`} value={f.camera} onChange={(e) => set({ camera: e.target.value })}>
          <option value="">{t('lib.all')}</option>
          {cams.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className={lbl}>
        {t('lib.lens')}
        <select className={`${field} max-w-40`} value={f.lens} onChange={(e) => set({ lens: e.target.value })}>
          <option value="">{t('lib.all')}</option>
          {lenses.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <span className={lbl}>
        {t('lib.iso')}
        <input type="number" min={0} className={`${field} w-16`} placeholder={t('lib.isoMin')} aria-label={`${t('lib.iso')} ${t('lib.isoMin')}`} value={f.isoMin ?? ''} onChange={(e) => set({ isoMin: e.target.value === '' ? null : Number(e.target.value) })} />
        –
        <input type="number" min={0} className={`${field} w-16`} placeholder={t('lib.isoMax')} aria-label={`${t('lib.iso')} ${t('lib.isoMax')}`} value={f.isoMax ?? ''} onChange={(e) => set({ isoMax: e.target.value === '' ? null : Number(e.target.value) })} />
      </span>
      <span className={lbl}>
        {t('lib.date')}
        <input type="date" className={field} aria-label={t('lib.dateFrom')} value={fromMs(f.dateFrom)} onChange={(e) => set({ dateFrom: toMs(e.target.value) })} />
        –
        <input type="date" className={field} aria-label={t('lib.dateTo')} value={fromMs(f.dateTo)} onChange={(e) => set({ dateTo: toMs(e.target.value, true) })} />
      </span>
      <label className={lbl}>
        {t('lib.keyword')}
        <select className={`${field} max-w-32`} value={f.keyword} onChange={(e) => set({ keyword: e.target.value })}>
          <option value="">{t('lib.all')}</option>
          {kws.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className={lbl}>
        {t('lib.edited')}
        <select className={field} value={f.edited} onChange={(e) => set({ edited: e.target.value as typeof f.edited })}>
          {(['any', 'yes', 'no'] as const).map((k) => (
            <option key={k} value={k}>
              {t(`lib.edited.${k}` as TKey)}
            </option>
          ))}
        </select>
      </label>
      <Button variant="ghost" disabled={!filtersActive(f)} onClick={() => useLibrary.getState().resetFilters()}>
        {t('lib.filtersReset')}
      </Button>
    </div>
  )
}

export function LibraryToolbar() {
  const t = useT()
  const view = useLibrary((s) => s.view)
  const setView = useLibrary((s) => s.setView)
  const filters = useLibrary((s) => s.filters)
  const setFilters = useLibrary((s) => s.setFilters)
  const sort = useLibrary((s) => s.sort)
  const setSort = useLibrary((s) => s.setSort)
  const size = useLibrary((s) => s.thumbSize)
  const setSize = useLibrary((s) => s.setThumbSize)
  const selection = useLibrary((s) => s.selection)
  const total = usePhotos((s) => s.order.length)
  const shown = useVisibleIds().length
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const active = filtersActive({ ...filters, text: '' })

  return (
    <div className="shrink-0">
      <div className="flex h-9 items-center gap-2 overflow-x-auto border-b border-line bg-bg-1 px-3 whitespace-nowrap [&>*]:shrink-0">
        <div role="group" aria-label="View" className="flex">
          {VIEWS.map((v) => (
            <Button key={v.id} variant="ghost" active={view === v.id} title={t(v.key)} onClick={() => setView(v.id)}>
              {t(v.key).replace(/ \(.\)$/, '')}
            </Button>
          ))}
        </div>
        <span className="h-4 w-px bg-line" />
        <input
          type="search"
          value={filters.text}
          onChange={(e) => setFilters({ text: e.target.value })}
          placeholder={t('lib.search')}
          aria-label={t('lib.search')}
          className={`${field} w-56`}
        />
        <Button variant="ghost" active={open || active} onClick={() => setOpen(!open)} aria-expanded={open}>
          {t('lib.filters')}
          {active && ' •'}
        </Button>
        <label className="flex items-center gap-1.5 text-xs text-fg-2">
          {t('lib.sort')}
          <select className={field} value={sort.key} onChange={(e) => setSort({ ...sort, key: e.target.value as SortKey })}>
            {SORTS.map((k) => (
              <option key={k} value={k}>
                {t(`lib.sort.${k}` as TKey)}
              </option>
            ))}
          </select>
        </label>
        <Button variant="ghost" title={t(sort.dir === 'asc' ? 'lib.asc' : 'lib.desc')} aria-label={t(sort.dir === 'asc' ? 'lib.asc' : 'lib.desc')} onClick={() => setSort({ ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' })}>
          {sort.dir === 'asc' ? '↑' : '↓'}
        </Button>
        <span className="flex-1" />
        <span className="text-xs whitespace-nowrap text-fg-2">{t('lib.count', { shown, total, sel: selection.length })}</span>
        <Button variant="ghost" disabled={!selection.length} onClick={() => setConfirm(true)}>
          {t('lib.remove')}
        </Button>
        {view === 'grid' && (
          <label className="flex items-center gap-1.5 text-xs text-fg-2">
            {t('lib.thumbSize')}
            <input type="range" min={80} max={360} step={4} value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label={t('lib.thumbSize')} className="w-24 accent-[var(--color-accent)]" />
          </label>
        )}
      </div>
      {open && <FilterPanel />}
      {confirm && (
        <Modal
          title={t('lib.removeTitle')}
          onClose={() => setConfirm(false)}
          footer={
            <>
              <Button onClick={() => setConfirm(false)}>{t('settings.cancel')}</Button>
              <Button
                variant="primary"
                onClick={() => {
                  const ids = targetIds()
                  setConfirm(false)
                  useLibrary.getState().setSelection([])
                  void usePhotos.getState().remove(ids)
                }}
              >
                {t('lib.removeConfirm')}
              </Button>
            </>
          }
        >
          <p className="text-sm">{t('lib.removeBody', { n: selection.length })}</p>
        </Modal>
      )}
    </div>
  )
}
