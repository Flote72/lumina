import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/design-system/Button'
import { Slider } from '@/design-system/Slider'
import { EmptyState } from '@/design-system/states'
import { renderTemplate } from '@/core/library/filter'
import type { WatermarkPosition } from '@/core/export/size'
import { useT, type TKey } from '@/i18n'
import { useExportSettings, type ExportScope } from '@/store/exportSettings'
import { useLibrary } from '@/store/library'
import { usePhotos } from '@/store/photos'
import { detectExportSupport, type ExportSupport } from './exportClient'
import type { ExportFormat } from './exporter'
import { cancelBatch, exportIdsFor, fileNames, runBatch } from './runBatch'

const sel = 'h-6 w-full rounded-[4px] border border-line bg-bg-2 px-1.5 text-sm text-fg-0'
const inp = 'h-6 w-full rounded-[4px] border border-line bg-bg-2 px-2 text-sm text-fg-0'

let supportPromise: Promise<ExportSupport> | null = null
function useSupport() {
  const [s, setS] = useState<ExportSupport | null>(null)
  useEffect(() => {
    supportPromise ??= detectExportSupport()
    void supportPromise.then(setS)
  }, [])
  return s
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid grid-cols-[104px_1fr] items-center gap-2 px-3 py-0.5 text-sm text-fg-1">
      <span className="truncate">{label}</span>
      {children}
    </label>
  )
}

export function ExportSettingsPanel() {
  const t = useT()
  const { options: o, setOptions, setResize, setSharpen } = useExportSettings()
  const sup = useSupport()
  const fmt = (f: ExportFormat) => (f === 'jpeg' ? 'JPEG' : f.toUpperCase())

  return (
    <div>
      <Field label={t('ex.format')}>
        <select className={sel} value={o.format} onChange={(e) => setOptions({ format: e.target.value as ExportFormat })}>
          {(['jpeg', 'png', 'webp', 'avif'] as const).map((f) => (
            <option key={f} value={f} disabled={sup ? !sup.formats[f] : false}>
              {fmt(f)}
              {sup && !sup.formats[f] ? ` — ${t('ex.formatUnsupported')}` : ''}
            </option>
          ))}
        </select>
      </Field>
      {o.format !== 'png' && <Slider label={t('ex.quality')} min={1} max={100} value={o.quality} defaultValue={90} onChange={(v) => setOptions({ quality: v })} />}
      <Field label={t('ex.colorSpace')}>
        <select className={sel} value={o.colorSpace} onChange={(e) => setOptions({ colorSpace: e.target.value as 'srgb' | 'display-p3' })}>
          <option value="srgb">{t('ex.srgb')}</option>
          <option value="display-p3" disabled={sup ? !sup.p3 : false}>
            {t('ex.p3')}
            {sup && !sup.p3 ? ` — ${t('ex.p3Unsupported')}` : ''}
          </option>
        </select>
      </Field>

      {o.colorSpace === 'display-p3' && <p className="px-3 pb-1 text-2xs text-fg-2">{t('ex.p3Note')}</p>}

      <div className="mt-1 px-3 pt-1 text-2xs tracking-wide text-fg-2 uppercase">{t('ex.resize')}</div>
      <Field label={t('ex.resize')}>
        <select className={sel} value={o.resize.mode} onChange={(e) => setResize({ mode: e.target.value as typeof o.resize.mode })}>
          {(['original', 'longEdge', 'percent', 'dimensions'] as const).map((m) => (
            <option key={m} value={m}>
              {t(`ex.resize.${m}` as TKey)}
            </option>
          ))}
        </select>
      </Field>
      {o.resize.mode === 'longEdge' && (
        <Field label="px">
          <input type="number" min={16} max={16384} className={inp} value={o.resize.longEdge} onChange={(e) => setResize({ longEdge: Math.max(16, Number(e.target.value) || 16) })} />
        </Field>
      )}
      {o.resize.mode === 'percent' && <Slider label="%" min={1} max={200} value={o.resize.percent} defaultValue={50} onChange={(v) => setResize({ percent: v })} />}
      {o.resize.mode === 'dimensions' && (
        <>
          <Field label={t('ex.width')}>
            <input type="number" min={0} className={inp} value={o.resize.width} onChange={(e) => setResize({ width: Math.max(0, Number(e.target.value) || 0) })} />
          </Field>
          <Field label={t('ex.height')}>
            <input type="number" min={0} className={inp} value={o.resize.height} onChange={(e) => setResize({ height: Math.max(0, Number(e.target.value) || 0) })} />
          </Field>
        </>
      )}
      {o.resize.mode !== 'original' && (
        <label className="flex items-center gap-2 px-3 py-0.5 text-sm text-fg-1">
          <input type="checkbox" className="accent-[var(--color-accent)]" checked={o.resize.noUpscale} onChange={(e) => setResize({ noUpscale: e.target.checked })} />
          {t('ex.noUpscale')}
        </label>
      )}

      <div className="mt-1 px-3 pt-1 text-2xs tracking-wide text-fg-2 uppercase">{t('ex.sharpen')}</div>
      <Field label={t('ex.sharpen')}>
        <select className={sel} value={o.sharpen.target} onChange={(e) => setSharpen({ target: e.target.value as typeof o.sharpen.target })}>
          {(['none', 'screen', 'print'] as const).map((k) => (
            <option key={k} value={k}>
              {t(`ex.sharpen.${k}` as TKey)}
            </option>
          ))}
        </select>
      </Field>
      {o.sharpen.target !== 'none' && (
        <Field label=" ">
          <select className={sel} value={o.sharpen.amount} onChange={(e) => setSharpen({ amount: e.target.value as typeof o.sharpen.amount })}>
            {(['low', 'standard', 'high'] as const).map((k) => (
              <option key={k} value={k}>
                {t(`ex.sharpen.${k}` as TKey)}
              </option>
            ))}
          </select>
        </Field>
      )}

      <div className="mt-1 px-3 pt-1 text-2xs tracking-wide text-fg-2 uppercase">{t('ex.metadata')}</div>
      <Field label={t('ex.metadata')}>
        <select className={sel} value={o.metadata} onChange={(e) => setOptions({ metadata: e.target.value as 'keep' | 'strip' })}>
          <option value="keep">{t('ex.metadata.keep')}</option>
          <option value="strip">{t('ex.metadata.strip')}</option>
        </select>
      </Field>
      <Field label={t('ex.copyright')}>
        <input className={inp} value={o.copyright} onChange={(e) => setOptions({ copyright: e.target.value })} placeholder="© 2026 Name" />
      </Field>
      <Field label={t('ex.creator')}>
        <input className={inp} value={o.creator} onChange={(e) => setOptions({ creator: e.target.value })} />
      </Field>
      <p className="px-3 pt-1 text-2xs text-fg-2">{t('ex.metadataNote')}</p>
    </div>
  )
}

export function FileNamingPanel() {
  const t = useT()
  const { template, setTemplate, scope, setScope, options } = useExportSettings()
  const first = usePhotos((s) => s.order[0])
  const p = usePhotos((s) => (first ? s.photos[first] : undefined))
  const preview = p ? renderTemplate(template, { name: p.name, seq: 1, date: p.capturedAt ?? p.addedAt, rating: p.rating, camera: p.camera }) : renderTemplate(template, { name: 'photo.jpg', seq: 1, date: 1767225600000, rating: 0, camera: '' })
  const ext = { jpeg: 'jpg', png: 'png', webp: 'webp', avif: 'avif' }[options.format]

  return (
    <div>
      <Field label={t('ex.template')}>
        <input className={`${inp} font-mono`} value={template} onChange={(e) => setTemplate(e.target.value)} spellCheck={false} />
      </Field>
      <p className="px-3 pb-1 text-2xs text-fg-2">{t('ex.templateHelp')}</p>
      <p className="px-3 pb-1 font-mono text-xs text-fg-1">
        {t('ex.templatePreview')}: {preview}.{ext}
      </p>
      <Field label={t('ex.scope')}>
        <select className={sel} value={scope} onChange={(e) => setScope(e.target.value as ExportScope)}>
          {(['selection', 'visible', 'all'] as const).map((s) => (
            <option key={s} value={s}>
              {t(`ex.scope.${s}` as TKey)}
            </option>
          ))}
        </select>
      </Field>
    </div>
  )
}

const POSITIONS: WatermarkPosition[] = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br']

export function WatermarkPanel() {
  const t = useT()
  const { options: o, setWatermark, watermarkImage, setWatermarkImage } = useExportSettings()
  const wm = o.watermark
  const file = useRef<HTMLInputElement>(null)

  const pick = (f: File | undefined) => {
    if (!f) return
    const r = new FileReader()
    r.onload = () => setWatermarkImage(String(r.result))
    r.readAsDataURL(f)
  }

  return (
    <div>
      <label className="flex items-center gap-2 px-3 py-0.5 text-sm text-fg-1">
        <input type="checkbox" className="accent-[var(--color-accent)]" checked={wm.enabled} onChange={(e) => setWatermark({ enabled: e.target.checked })} />
        {t('ex.wm')}
      </label>
      {wm.enabled && (
        <>
          <Field label={t('ex.wm.kind')}>
            <select className={sel} value={wm.kind} onChange={(e) => setWatermark({ kind: e.target.value as 'text' | 'image' })}>
              <option value="text">{t('ex.wm.text')}</option>
              <option value="image">{t('ex.wm.image')}</option>
            </select>
          </Field>
          {wm.kind === 'text' ? (
            <Field label={t('ex.wm.textValue')}>
              <input className={inp} value={wm.text} onChange={(e) => setWatermark({ text: e.target.value })} />
            </Field>
          ) : (
            <div className="flex items-center gap-2 px-3 py-0.5">
              <Button onClick={() => file.current?.click()}>{t('ex.wm.pickImage')}</Button>
              {watermarkImage ? <img src={watermarkImage} alt="" className="h-6 max-w-16 rounded-[2px] bg-bg-3 object-contain" /> : <span className="text-2xs text-fg-2">{t('ex.wm.noImage')}</span>}
              <input ref={file} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
            </div>
          )}
          <div className="grid grid-cols-[104px_1fr] items-center gap-2 px-3 py-1 text-sm text-fg-1">
            <span>{t('ex.wm.position')}</span>
            <div role="radiogroup" aria-label={t('ex.wm.position')} className="grid w-[72px] grid-cols-3 gap-1">
              {POSITIONS.map((p) => (
                <button key={p} type="button" role="radio" aria-checked={wm.position === p} aria-label={p} onClick={() => setWatermark({ position: p })} className={`h-5 rounded-[3px] border ${wm.position === p ? 'border-accent bg-accent/30' : 'border-line bg-bg-2 hover:bg-bg-3'}`} />
              ))}
            </div>
          </div>
          <Slider label={t('ex.wm.size')} min={2} max={80} value={wm.sizePct} defaultValue={18} onChange={(v) => setWatermark({ sizePct: v })} />
          <Slider label={t('ex.wm.opacity')} min={5} max={100} value={wm.opacity} defaultValue={70} onChange={(v) => setWatermark({ opacity: v })} />
          <Slider label={t('ex.wm.margin')} min={0} max={20} step={0.5} value={wm.marginPct} defaultValue={3} onChange={(v) => setWatermark({ marginPct: v })} />
        </>
      )}
    </div>
  )
}

/** Center of the Export module: what will be exported, run / cancel, per-photo progress. */
export function ExportStage() {
  const t = useT()
  const sup = useSupport()
  const { scope, template, options, running, items, summary } = useExportSettings()
  // re-evaluate the target list when selection / visibility / photos change
  const selection = useLibrary((s) => s.selection)
  const currentId = usePhotos((s) => s.currentId)
  const photos = usePhotos((s) => s.photos)
  const order = usePhotos((s) => s.order)
  const filters = useLibrary((s) => s.filters)
  const coll = useLibrary((s) => s.activeCollection)
  const ids = useMemo(
    () => exportIdsFor(scope),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scope, selection, currentId, photos, order, filters, coll],
  )
  const ext = { jpeg: 'jpg', png: 'png', webp: 'webp', avif: 'avif' }[options.format]
  const names = useMemo(() => fileNames(ids, template, ext), [ids, template, ext])

  if (sup && !sup.worker) return <EmptyState title={t('ex.noWorker')} />
  if (!ids.length && !items.length) return <EmptyState title={t('ex.nothing')} body={t('empty.export.body')} />

  // Keep showing the finished list right after a run, but the moment the target selection changes
  // (new photos picked, scope changed, …) switch back to a fresh "waiting" list for the new batch.
  const sameBatch = items.length === ids.length && items.every((it, i) => it.id === ids[i])
  const list = running || sameBatch ? items : ids.map((id, i) => ({ id, name: names[i]!, status: 'waiting' as const, progress: 0, message: undefined }))
  const done = items.filter((i) => i.status === 'done' || i.status === 'error').length

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-line bg-bg-1 px-4 py-3">
        {running ? (
          <>
            <Button onClick={cancelBatch}>{t('ex.cancel')}</Button>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-3" role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={done}>
              <div className="h-full bg-accent transition-[width]" style={{ width: `${(done / Math.max(1, items.length)) * 100}%` }} />
            </div>
            <span className="font-mono text-xs text-fg-2">
              {done}/{items.length}
            </span>
          </>
        ) : (
          <>
            <Button variant="primary" disabled={!ids.length} onClick={() => void runBatch()}>
              {t('ex.count', { n: ids.length })}
            </Button>
            <span className="text-xs text-fg-2">{ids.length > 1 ? t('ex.zipNote') : ''}</span>
            {summary && (
              <span className="text-sm text-accent" role="status">
                {summary}
              </span>
            )}
          </>
        )}
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
        {list.map((it) => (
          <li key={it.id} className="flex items-center gap-3 border-b border-line py-1.5 text-sm">
            {photos[it.id]?.thumbUrl && <img src={photos[it.id]!.thumbUrl!} alt="" className="size-8 rounded-[2px] object-cover" />}
            <span className="min-w-0 flex-1 truncate font-mono text-xs">{it.name}</span>
            <span className={`w-28 shrink-0 text-right text-xs ${it.status === 'error' ? 'text-danger' : it.status === 'done' ? 'text-accent' : 'text-fg-2'}`} title={it.message}>
              {it.status === 'working' ? `${t('ex.working')} ${Math.round(it.progress * 100)}%` : it.status === 'done' ? t('ex.done') : it.status === 'error' ? `${t('ex.failed')}: ${it.message ?? ''}` : t('ex.waiting')}
            </span>
          </li>
        ))}
      </ul>
      <p className="shrink-0 border-t border-line px-4 py-2 text-2xs text-fg-2">{t('ex.tiled')}</p>
    </div>
  )
}
