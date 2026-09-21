import { useState } from 'react'
import { Button } from '@/design-system/Button'
import { useT } from '@/i18n'
import { addKeywords, LABELS, removeKeyword, setFlag, setRating, targetIds, toggleLabel, useLibrary } from '@/store/library'
import { usePhotos } from '@/store/photos'
import { LABEL_COLOR } from './labelColors'
import { Stars } from './PhotoBits'

/** Left panel: catalog + manual collections. */
export function CatalogPanel() {
  const t = useT()
  const total = usePhotos((s) => s.order.length)
  const collections = useLibrary((s) => s.collections)
  const items = useLibrary((s) => s.collectionItems)
  const active = useLibrary((s) => s.activeCollection)
  const setActive = useLibrary((s) => s.setActiveCollection)
  const selection = useLibrary((s) => s.selection)
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<string | null>(null)

  const row = (isActive: boolean) => `flex h-6 items-center ${isActive ? 'bg-bg-3 text-accent' : 'text-fg-1 hover:bg-bg-2 hover:text-fg-0'}`
  const create = async () => {
    if (!name.trim()) return
    const id = await useLibrary.getState().addCollection(name)
    if (selection.length) await useLibrary.getState().addToCollection(id, selection)
    setName('')
  }

  return (
    <div>
      <button type="button" className={`${row(active === null)} w-full px-3 text-sm`} onClick={() => setActive(null)}>
        <span className="flex-1 truncate text-left">{t('coll.all')}</span>
        <span className="font-mono text-2xs text-fg-2">{total}</span>
      </button>
      <ul>
        {collections.map((c) => (
          <li key={c.id} className={`${row(active === c.id)} group/c pr-1`}>
            {editing === c.id ? (
              <input
                autoFocus
                defaultValue={c.name}
                aria-label={t('coll.rename')}
                className="mx-2 h-5 min-w-0 flex-1 rounded-[3px] border border-line-strong bg-bg-2 px-1 text-sm"
                onBlur={(e) => {
                  void useLibrary.getState().renameCollection(c.id, e.target.value.trim() || c.name)
                  setEditing(null)
                }}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              />
            ) : (
              <button type="button" className="flex h-full min-w-0 flex-1 items-center px-3 text-left text-sm" onClick={() => setActive(c.id)} onDoubleClick={() => setEditing(c.id)} title={t('coll.rename')}>
                <span className="flex-1 truncate">{c.name}</span>
                <span className="font-mono text-2xs text-fg-2">{items[c.id]?.length ?? 0}</span>
              </button>
            )}
            <button type="button" className="hidden size-5 shrink-0 text-fg-1 group-hover/c:block hover:text-accent disabled:opacity-40" disabled={!selection.length} title={t('coll.add')} aria-label={t('coll.add')} onClick={() => void useLibrary.getState().addToCollection(c.id, selection)}>
              +
            </button>
            {active === c.id && (
              <button type="button" className="hidden size-5 shrink-0 text-fg-1 group-hover/c:block hover:text-accent disabled:opacity-40" disabled={!selection.length} title={t('coll.removeFrom')} aria-label={t('coll.removeFrom')} onClick={() => void useLibrary.getState().removeFromCollection(c.id, selection)}>
                −
              </button>
            )}
            <button type="button" className="hidden size-5 shrink-0 text-fg-2 group-hover/c:block hover:text-danger" title={t('coll.delete')} aria-label={t('coll.delete')} onClick={() => void useLibrary.getState().removeCollection(c.id)}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-1 px-3 pt-2">
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void create()} placeholder={t('coll.namePlaceholder')} aria-label={t('coll.new')} className="h-6 min-w-0 flex-1 rounded-[4px] border border-line bg-bg-2 px-2 text-sm" />
        <Button onClick={() => void create()} disabled={!name.trim()} title={t('coll.new')} aria-label={t('coll.new')}>
          +
        </Button>
      </div>
    </div>
  )
}

const fmtSize = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`)
const fmtShutter = (s: number | null) => (s === null ? '' : s >= 1 ? `${s}s` : `1/${Math.round(1 / s)}s`)

function Row({ k, v }: { k: string; v: string }) {
  if (!v) return null
  return (
    <div className="flex gap-2 px-3 py-0.5 text-xs">
      <dt className="w-16 shrink-0 text-fg-2">{k}</dt>
      <dd className="min-w-0 flex-1 break-words text-fg-0">{v}</dd>
    </div>
  )
}

/** Right panel: metadata, rating / flag / label, keywords. */
export function MetadataPanel() {
  const t = useT()
  const cur = usePhotos((s) => (s.currentId ? s.photos[s.currentId] : undefined))
  const selection = useLibrary((s) => s.selection)
  const [kw, setKw] = useState('')
  if (!cur) return <p className="px-3 py-1 text-xs text-fg-2">{t('meta.noSelection')}</p>

  const ids = selection.length > 1 ? targetIds() : [cur.id]
  const dt = cur.capturedAt ? new Date(cur.capturedAt).toLocaleString() : ''
  const exposure = [fmtShutter(cur.exposureTime), cur.fNumber ? `f/${cur.fNumber}` : ''].filter(Boolean).join('  ')

  return (
    <div className="pb-2">
      {selection.length > 1 && <p className="px-3 pb-1 text-2xs text-accent">{t('meta.multi', { n: selection.length })}</p>}
      <div className="flex items-center gap-3 px-3 pb-1">
        <Stars value={cur.rating} size={16} onChange={(n) => setRating(ids, n)} />
        <button type="button" aria-pressed={cur.flag === 'pick'} title="Pick (P)" className={`h-5 rounded-[3px] border px-1.5 text-xs ${cur.flag === 'pick' ? 'border-white bg-white text-black' : 'border-line text-fg-2 hover:text-fg-0'}`} onClick={() => setFlag(ids, 'pick')}>
          ⚑
        </button>
        <button type="button" aria-pressed={cur.flag === 'reject'} title="Reject (X)" className={`h-5 rounded-[3px] border px-1.5 text-xs ${cur.flag === 'reject' ? 'border-danger text-danger' : 'border-line text-fg-2 hover:text-fg-0'}`} onClick={() => setFlag(ids, 'reject')}>
          ✕
        </button>
        <span className="flex gap-1">
          {LABELS.map((l, i) => (
            <button key={l} type="button" aria-pressed={cur.label === l} aria-label={t(`lib.label.${l}` as never)} title={`${t(`lib.label.${l}` as never)} (${i + 6})`} onClick={() => toggleLabel(ids, l)} className="size-4 rounded-[3px] border" style={{ background: LABEL_COLOR[l as keyof typeof LABEL_COLOR], opacity: cur.label === l ? 1 : 0.4, borderColor: cur.label === l ? '#fff' : 'transparent' }} />
          ))}
        </span>
      </div>

      <dl className="border-t border-line pt-1">
        <Row k={t('meta.file')} v={cur.name} />
        <Row k={t('meta.size')} v={fmtSize(cur.size)} />
        <Row k={t('meta.dimensions')} v={cur.width ? `${cur.width} × ${cur.height} (${((cur.width * cur.height) / 1e6).toFixed(1)} MP)` : ''} />
        <Row k={t('meta.date')} v={dt} />
        <Row k={t('meta.camera')} v={cur.camera} />
        <Row k={t('meta.lens')} v={cur.lens} />
        <Row k={t('meta.exposure')} v={exposure} />
        <Row k={t('meta.iso')} v={cur.iso ? String(cur.iso) : ''} />
        <Row k={t('meta.focal')} v={cur.focalLength ? `${Math.round(cur.focalLength)} mm` : ''} />
        <Row k={t('meta.raw')} v={cur.raw ? t(cur.rawMethod === 'preview' ? 'meta.rawPreview' : 'meta.rawLibraw') : ''} />
      </dl>
      {!cur.camera && !cur.iso && !cur.capturedAt && <p className="px-3 py-1 text-xs text-fg-2">{t('meta.none')}</p>}

      <div className="mt-1 border-t border-line px-3 pt-2">
        <div className="mb-1 text-2xs tracking-wide text-fg-2 uppercase">{t('meta.keywords')}</div>
        <div className="mb-1 flex flex-wrap gap-1">
          {cur.keywords.map((k) => (
            <span key={k} className="inline-flex items-center gap-1 rounded-[3px] bg-bg-3 px-1.5 py-0.5 text-xs">
              {k}
              <button type="button" aria-label={`Remove ${k}`} className="text-fg-2 hover:text-danger" onClick={() => removeKeyword(ids, k)}>
                ×
              </button>
            </span>
          ))}
        </div>
        <input
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && kw.trim()) {
              addKeywords(ids, kw.split(','))
              setKw('')
            }
          }}
          placeholder={t('meta.addKeyword')}
          aria-label={t('meta.addKeyword')}
          className="h-6 w-full rounded-[4px] border border-line bg-bg-2 px-2 text-sm"
        />
      </div>
    </div>
  )
}
