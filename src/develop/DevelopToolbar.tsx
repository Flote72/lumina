import { Button } from '@/design-system/Button'
import { Slider } from '@/design-system/Slider'
import {
  applyRatio,
  cropToFrameRect,
  flipRatio,
  frameRectToCrop,
  RATIO_PRESETS,
  ratioValue,
} from '@/core/geometry/crop'
import { DEFAULT_CROP } from '@/core/params/params'
import { useT, type TKey } from '@/i18n'
import { useDevelop, type GuideKind } from '@/store/develop'
import { usePhotos } from '@/store/photos'
import { applyCrop, cancelCrop, canCrop, setCropAngle, toggleCrop } from './cropActions'

const ZOOMS = [
  { mode: 'fit', label: 'toolbar.fit' },
  { mode: 'fill', label: 'toolbar.fill' },
  { mode: '1:1', label: '100%' },
  { mode: '2:1', label: '200%' },
] as const

const selectCls = 'h-6 rounded-[4px] border border-line bg-bg-2 px-1.5 text-sm text-fg-0 hover:bg-bg-3'

function CropBar() {
  const t = useT()
  const id = usePhotos((s) => s.currentId)!
  const photo = usePhotos((s) => s.photos[id])!
  const crop = usePhotos((s) => s.params[id]!.crop)
  const edit = usePhotos((s) => s.edit)
  const commit = usePhotos((s) => s.commit)
  const guide = useDevelop((s) => s.guide)
  const { width: W, height: H } = photo

  const setRatio = (ratio: string) => {
    edit((p) => {
      const c = p.crop
      const r = cropToFrameRect(c, W, H)
      const v = ratioValue(ratio, W, H)
      const next = v ? applyRatio(r, v, c.angle, W, H) : r
      return { ...p, crop: frameRectToCrop(next, c.angle, ratio, W, H) }
    })
    commit('Crop')
  }
  const flip = () => {
    const base = crop.ratio === 'original' ? `${W}:${H}` : crop.ratio
    if (base === 'free') return
    setRatio(flipRatio(base))
  }
  return (
    <>
      <label className="flex items-center gap-1.5 text-xs text-fg-2">
        {t('crop.aspect')}
        <select className={selectCls} value={crop.ratio} onChange={(e) => setRatio(e.target.value)} aria-label={t('crop.aspect')}>
          {!(RATIO_PRESETS as readonly string[]).includes(crop.ratio) && <option value={crop.ratio}>{crop.ratio}</option>}
          {RATIO_PRESETS.map((r) => (
            <option key={r} value={r}>
              {r === 'original' || r === 'free' ? t(`ratio.${r}` as TKey) : r}
            </option>
          ))}
        </select>
      </label>
      <Button variant="ghost" onClick={flip} title={t('crop.flip')} aria-label={t('crop.flip')}>
        ⇄
      </Button>
      <div className="w-56">
        <Slider label={t('crop.angle')} min={-45} max={45} step={0.1} value={crop.angle} defaultValue={0} onChange={setCropAngle} onCommit={() => commit('Angle')} />
      </div>
      <label className="flex items-center gap-1.5 text-xs text-fg-2">
        {t('crop.guide')}
        <select className={selectCls} value={guide} onChange={(e) => useDevelop.setState({ guide: e.target.value as GuideKind })} aria-label={t('crop.guide')}>
          {(['none', 'thirds', 'golden', 'grid', 'diagonal'] as const).map((g) => (
            <option key={g} value={g}>
              {t(`guide.${g}` as TKey)}
            </option>
          ))}
        </select>
      </label>
      <Button
        onClick={() => {
          edit((p) => ({ ...p, crop: { ...DEFAULT_CROP } }))
          commit('Crop')
        }}
      >
        {t('crop.reset')}
      </Button>
      <span className="flex-1" />
      <Button onClick={cancelCrop}>{t('crop.cancel')}</Button>
      <Button variant="primary" onClick={applyCrop}>
        {t('crop.done')}
      </Button>
    </>
  )
}

export function DevelopToolbar({ zoomPct }: { zoomPct: number }) {
  const t = useT()
  const { zoomMode, setZoomMode, compare, setCompare, clipping, toggleClipping, cropEdit } = useDevelop()
  const enabled = canCrop()

  return (
    <div role="toolbar" aria-label="Develop toolbar" className="flex h-9 shrink-0 items-center gap-2 overflow-x-auto border-t border-line bg-bg-1 px-3">
      {cropEdit ? (
        <CropBar />
      ) : (
        <>
          <Button variant="ghost" active={false} onClick={toggleCrop} disabled={!enabled} title={t('toolbar.crop')}>
            {t('toolbar.crop')}
          </Button>
          <span className="h-4 w-px bg-line" />
          <Button variant="ghost" active={compare.mode === 'before'} onClick={() => setCompare(compare.mode === 'before' ? 'off' : 'before')} title={t('toolbar.compare')} disabled={!enabled}>
            Before
          </Button>
          <Button variant="ghost" active={compare.mode === 'lr'} onClick={() => setCompare(compare.mode === 'lr' ? 'off' : 'lr')} title={t('toolbar.compareLR')} disabled={!enabled}>
            ◧
          </Button>
          <Button variant="ghost" active={compare.mode === 'tb'} onClick={() => setCompare(compare.mode === 'tb' ? 'off' : 'tb')} title={t('toolbar.compareTB')} disabled={!enabled}>
            ⬒
          </Button>
          <Button variant="ghost" active={clipping} onClick={toggleClipping} title={t('toolbar.clipping')} disabled={!enabled}>
            J
          </Button>
          <span className="flex-1" />
          <span className="text-xs text-fg-2">{t('toolbar.zoom')}</span>
          {ZOOMS.map((z) => (
            <Button key={z.mode} variant="ghost" active={zoomMode === z.mode} onClick={() => setZoomMode(z.mode)} disabled={!enabled}>
              {z.label.startsWith('toolbar') ? t(z.label as TKey) : z.label}
            </Button>
          ))}
          <span className="w-12 text-right font-mono text-xs text-fg-2 tabular-nums">{Math.round(zoomPct)}%</span>
        </>
      )}
    </div>
  )
}
