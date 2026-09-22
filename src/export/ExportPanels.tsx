import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/design-system/Button'
import { Slider } from '@/design-system/Slider'
import { EmptyState } from '@/design-system/states'
import { renderTemplate } from '@/core/library/filter'
import {
  buildFrameLines,
  buildStrapParts,
  frameHasContent,
  strapHasContent,
  type FrameBackground,
  type FrameLines,
  type FramePosition,
  type FrameSettings,
  type FrameStyle,
  type StrapParts,
} from '@/core/export/frame'
import { BRAND_KEYS, BRAND_LABELS, resolveBrandKey, type BrandKey } from '@/core/export/brandLogos'
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

const FRAME_STYLES: FrameStyle[] = ['minimal', 'strap', 'film']
const SAMPLE_EXIF = { model: 'Camera Body', lens: 'Lens Name', focalLength: 35, fNumber: 2.8, exposureTime: 1 / 500, iso: 100, capturedAt: 1767225600000 }

/** A brand logo the user has uploaded (Export → EXIF Frame → logo grid), if any. Local only (see store). */
function BrandLogo({ cameraText, className }: { cameraText: string | undefined; className: string }) {
  const key = resolveBrandKey(cameraText)
  const src = useExportSettings((s) => (key ? s.brandLogos[key] : undefined))
  if (!src) return null
  return <img src={src} alt="" className={className} />
}

/** Downscale an uploaded image to a small PNG data URL (keeps localStorage lean; drawing scales to text height anyway). */
function fileToLogoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const max = 160
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
      const w = Math.max(1, Math.round(img.naturalWidth * k))
      const h = Math.max(1, Math.round(img.naturalHeight * k))
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(img.src)
      resolve(c.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('image decode failed'))
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Per-brand logo upload grid. Each tile is a fixed-size drop target so the layout stays tidy whether
 * a brand has an image or not. Images are stored as data URLs in this browser's localStorage only —
 * never written to a file or committed (camera brand marks are third-party trademarks).
 */
function BrandLogoGrid() {
  const t = useT()
  const logos = useExportSettings((s) => s.brandLogos)
  const setBrandLogo = useExportSettings((s) => s.setBrandLogo)
  const inputs = useRef<Partial<Record<BrandKey, HTMLInputElement | null>>>({})

  const pick = async (key: BrandKey, file: File | undefined) => {
    if (!file) return
    try {
      setBrandLogo(key, await fileToLogoDataUrl(file))
    } catch {
      /* not a decodable image — ignore */
    }
  }

  return (
    <div>
      <p className="px-3 pb-1.5 text-2xs text-fg-2">{t('ex.frame.logoNote')}</p>
      <div className="grid grid-cols-4 gap-2 px-3 pb-2">
        {BRAND_KEYS.map((key) => {
          const src = logos[key]
          return (
            <div key={key} className="flex flex-col items-center gap-1">
              <div className="group relative">
                <button
                  type="button"
                  onClick={() => inputs.current[key]?.click()}
                  aria-label={`${BRAND_LABELS[key]}: ${t('ex.frame.logoUpload')}`}
                  title={BRAND_LABELS[key]}
                  className={`flex size-12 items-center justify-center overflow-hidden rounded-[5px] border ${src ? 'border-line bg-bg-0' : 'border-dashed border-line-strong bg-bg-2 hover:border-fg-2'}`}
                >
                  {src ? <img src={src} alt="" className="size-full object-contain p-1" /> : <span className="text-base text-fg-2">+</span>}
                </button>
                {src && (
                  <button
                    type="button"
                    onClick={() => setBrandLogo(key, null)}
                    aria-label={`${BRAND_LABELS[key]}: ${t('ex.frame.logoRemove')}`}
                    title={t('ex.frame.logoRemove')}
                    className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full border border-line-strong bg-bg-3 text-2xs leading-none text-fg-1 opacity-0 hover:text-danger group-hover:opacity-100 group-focus-within:opacity-100"
                  >
                    ×
                  </button>
                )}
                <input
                  ref={(el) => {
                    inputs.current[key] = el
                  }}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    void pick(key, e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </div>
              <span className="max-w-12 truncate text-center text-[9px] text-fg-2">{BRAND_LABELS[key]}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** CSS approximation of the caption bar drawn by core/export/frame.ts — close enough for a settings-panel preview. */
function FrameCaption({ fr, lines, cameraText }: { fr: FrameSettings; lines: FrameLines; cameraText: string | undefined }) {
  const dark = fr.background === 'dark'
  const oneLine = fr.style === 'minimal' || !lines.primary || !lines.secondary
  return (
    <div className={`flex items-center gap-2 ${fr.style === 'film' ? '' : 'px-3 py-2'} ${fr.style === 'film' ? 'justify-center' : 'justify-start'}`}>
      {fr.showLogo && <BrandLogo cameraText={cameraText} className="h-5 w-5 shrink-0 object-contain" />}
      <div className={`flex flex-col justify-center gap-0.5 ${dark ? 'text-[#f2f1ec]' : 'text-[#141414]'} ${fr.style === 'film' ? 'items-center text-center' : 'items-start'}`}>
        {oneLine ? (
          <div className="text-xs">{[lines.primary, lines.secondary].filter(Boolean).join('   ·   ')}</div>
        ) : (
          <>
            <div className="text-xs font-semibold">{lines.primary}</div>
            {fr.style === 'strap' && <div className={`my-0.5 w-full border-t ${dark ? 'border-white/20' : 'border-black/15'}`} />}
            <div className={`text-2xs ${dark ? 'text-[#9a9a94]' : 'text-[#5a5a56]'}`}>{lines.secondary}</div>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * CSS approximation of the Strap style's fixed two-column layout (see core/export/frame.ts drawStrapFrame):
 * left = exposure (bold) / date (gray); right = logo + divider + camera (bold) / lens (gray).
 */
function StrapCaption({ fr, parts, cameraText }: { fr: FrameSettings; parts: StrapParts; cameraText: string | undefined }) {
  const dark = fr.background === 'dark'
  const primary = dark ? 'text-[#f2f1ec]' : 'text-[#141414]'
  const secondary = dark ? 'text-[#9a9a94]' : 'text-[#5a5a56]'
  const hasRight = !!(parts.camera || parts.lens)
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <div className="flex min-w-0 flex-col justify-center gap-0.5">
        {parts.exposure && <div className={`truncate text-xs font-semibold ${primary}`}>{parts.exposure}</div>}
        {parts.date && <div className={`truncate text-2xs ${secondary}`}>{parts.date}</div>}
      </div>
      {(hasRight || fr.showLogo) && (
        <div className="flex min-w-0 items-center gap-2">
          {fr.showLogo && <BrandLogo cameraText={cameraText} className="h-5 w-5 shrink-0 object-contain" />}
          {hasRight && (
            <>
              {fr.showLogo && <div className={`h-6 w-px shrink-0 ${dark ? 'bg-white/20' : 'bg-black/15'}`} />}
              <div className="flex min-w-0 flex-col items-end justify-center gap-0.5 text-right">
                {parts.camera && <div className={`truncate text-xs font-semibold ${primary}`}>{parts.camera}</div>}
                {parts.lens && <div className={`truncate text-2xs ${secondary}`}>{parts.lens}</div>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** Caption bar with camera / lens / exposure info, drawn around the exported photo (see core/export/frame.ts). */
export function FramePanel() {
  const t = useT()
  const { options: o, setFrame } = useExportSettings()
  const fr = o.frame
  const cur = usePhotos((s) => (s.currentId ? s.photos[s.currentId] : undefined))
  const previewExif = cur
    ? { model: cur.camera, lens: cur.lens, focalLength: cur.focalLength, fNumber: cur.fNumber, exposureTime: cur.exposureTime, iso: cur.iso, capturedAt: cur.capturedAt }
    : SAMPLE_EXIF
  const isStrap = fr.style === 'strap'
  const lines = buildFrameLines(previewExif, fr)
  const strapParts = buildStrapParts(previewExif, fr)
  const hasContent = isStrap ? strapHasContent(strapParts) : frameHasContent(lines)

  return (
    <div>
      <label className="flex items-center gap-2 px-3 py-0.5 text-sm text-fg-1">
        <input type="checkbox" className="accent-[var(--color-accent)]" checked={fr.enabled} onChange={(e) => setFrame({ enabled: e.target.checked })} />
        {t('ex.frame.enable')}
      </label>
      <p className="px-3 pb-1 text-2xs text-fg-2">{t('ex.frame.note')}</p>
      {fr.enabled && (
        <>
          <Field label={t('ex.frame.style')}>
            <select className={sel} value={fr.style} onChange={(e) => setFrame({ style: e.target.value as FrameStyle })}>
              {FRAME_STYLES.map((s) => (
                <option key={s} value={s}>
                  {t(`ex.frame.style.${s}` as TKey)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('ex.frame.position')}>
            <select className={sel} value={fr.position} onChange={(e) => setFrame({ position: e.target.value as FramePosition })}>
              <option value="bottom">{t('ex.frame.position.bottom')}</option>
              <option value="top">{t('ex.frame.position.top')}</option>
            </select>
          </Field>
          <Field label={t('ex.frame.background')}>
            <select className={sel} value={fr.background} onChange={(e) => setFrame({ background: e.target.value as FrameBackground })}>
              <option value="light">{t('ex.frame.background.light')}</option>
              <option value="dark">{t('ex.frame.background.dark')}</option>
            </select>
          </Field>

          <div className="flex flex-wrap gap-x-4 gap-y-1 px-3 py-1.5">
            {(
              [
                ['showCamera', 'ex.frame.showCamera'],
                ['showLens', 'ex.frame.showLens'],
                ['showFocalLength', 'ex.frame.showFocalLength'],
                ['showExposure', 'ex.frame.showExposure'],
                ['showDate', 'ex.frame.showDate'],
                ['showLogo', 'ex.frame.showLogo'],
              ] as const
            )
              .filter(([key]) => key !== 'showFocalLength' || !isStrap) // baked into the manual lens name on Strap
              .map(([key, label]) => (
                <label key={key} className="flex items-center gap-1.5 text-sm text-fg-1">
                  <input type="checkbox" className="accent-[var(--color-accent)]" checked={fr[key]} onChange={(e) => setFrame({ [key]: e.target.checked })} />
                  {t(label)}
                </label>
              ))}
          </div>
          {fr.showLens && (
            <Field label={t('ex.frame.lensOverride')}>
              <input className={inp} value={fr.lensOverride} onChange={(e) => setFrame({ lensOverride: e.target.value })} placeholder={t('ex.frame.lensOverridePlaceholder')} />
            </Field>
          )}
          <Field label={t('ex.frame.customText')}>
            <input className={inp} value={fr.customText} onChange={(e) => setFrame({ customText: e.target.value })} placeholder={t('ex.frame.customTextPlaceholder')} />
          </Field>
          {fr.showLogo && <BrandLogoGrid />}

          {!hasContent && <p className="px-3 pb-1 text-2xs text-danger">{t('ex.frame.empty')}</p>}
          {hasContent && (
            <div className="mx-3 mb-2 overflow-hidden rounded-[4px] border border-line" aria-label={t('ex.frame.preview')}>
              <div className={`flex flex-col ${fr.background === 'dark' ? 'bg-[#0c0c0d]' : 'bg-[#f7f6f2]'} ${fr.style === 'film' ? 'gap-2 p-[5%]' : 'gap-0'}`}>
                {fr.position === 'top' &&
                  (isStrap ? <StrapCaption fr={fr} parts={strapParts} cameraText={previewExif.model} /> : <FrameCaption fr={fr} lines={lines} cameraText={previewExif.model} />)}
                {cur?.thumbUrl ? (
                  <img
                    src={cur.thumbUrl}
                    alt=""
                    className={fr.style === 'film' ? 'rounded-[1px]' : ''}
                    style={{ width: '100%', aspectRatio: cur.width && cur.height ? `${cur.width} / ${cur.height}` : '3 / 2', objectFit: 'cover' }}
                  />
                ) : (
                  <div className="flex aspect-[3/2] items-center justify-center bg-bg-3 text-2xs text-fg-2">{t('lib.selectPhoto')}</div>
                )}
                {fr.position === 'bottom' &&
                  (isStrap ? <StrapCaption fr={fr} parts={strapParts} cameraText={previewExif.model} /> : <FrameCaption fr={fr} lines={lines} cameraText={previewExif.model} />)}
              </div>
            </div>
          )}
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
