import { Button } from '@/design-system/Button'
import { Slider } from '@/design-system/Slider'
import { DEFAULT_MASK_ADJUST, MAX_MASKS, type MaskComponent, type MaskKind, type MaskOp } from '@/core/params/params'
import { useT, type TKey } from '@/i18n'
import { useDevelop } from '@/store/develop'
import { usePhotos } from '@/store/photos'
import { useToastStore } from '@/store/toast'
import { usePanelReady } from '../panels/usePanelReady'
import { commitEdit, duplicateMask, removeComponent, removeMask, runAiMask, setAdjust, startMask, updateComponent, updateMask } from './maskActions'

const KINDS: MaskKind[] = ['brush', 'linear', 'radial', 'luminance', 'color']
const OPS: MaskOp[] = ['add', 'subtract', 'intersect']
const opKey = (o: MaskOp): TKey => (o === 'add' ? 'mask.opAdd' : o === 'subtract' ? 'mask.opSubtract' : 'mask.opIntersect')
const sel = 'h-6 max-w-[88px] rounded-[4px] border border-line bg-bg-2 px-1 text-xs text-fg-0'

const ADJUST: { key: keyof typeof DEFAULT_MASK_ADJUST; min: number; max: number; step?: number }[] = [
  { key: 'exposure', min: -5, max: 5, step: 0.01 },
  { key: 'contrast', min: -100, max: 100 },
  { key: 'highlights', min: -100, max: 100 },
  { key: 'shadows', min: -100, max: 100 },
  { key: 'temp', min: -100, max: 100 },
  { key: 'tint', min: -100, max: 100 },
  { key: 'saturation', min: -100, max: 100 },
  { key: 'texture', min: -100, max: 100 },
  { key: 'clarity', min: -100, max: 100 },
  { key: 'dehaze', min: -100, max: 100 },
  { key: 'sharpness', min: -100, max: 100 },
  { key: 'noise', min: 0, max: 100 },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-1">
      <div className="px-3 pt-1 pb-0.5 text-2xs tracking-wide text-fg-2 uppercase">{title}</div>
      {children}
    </div>
  )
}

function ComponentParams({ maskId, c }: { maskId: string; c: MaskComponent }) {
  const t = useT()
  const brush = useDevelop((s) => s.brush)
  const setBrush = useDevelop((s) => s.setBrush)
  const draw = useDevelop((s) => s.maskDraw)
  const setDraw = useDevelop((s) => s.setMaskDraw)
  const done = (l: string) => () => commitEdit(l)

  if (c.kind === 'brush') {
    const painting = draw?.kind === 'brush' && draw.maskId === maskId
    return (
      <div>
        <div className="flex gap-1 px-3 pb-1">
          <Button className="flex-1" active={painting} onClick={() => useDevelop.getState().setMaskDraw(painting ? null : { kind: 'brush', op: 'add', maskId })}>
            {t('mask.paint')}
          </Button>
          <Button active={brush.erase} title={t('mask.erase')} onClick={() => setBrush({ erase: !brush.erase })}>
            −
          </Button>
        </div>
        <Slider label={t('mask.brushSize')} min={0.5} max={40} step={0.5} value={Math.round(brush.size * 1000) / 10} defaultValue={6} onChange={(v) => setBrush({ size: v / 100 })} />
        <Slider label={t('mask.brushFeather')} min={0} max={100} value={brush.feather} defaultValue={60} onChange={(v) => setBrush({ feather: v })} />
        <Slider label={t('mask.brushFlow')} min={1} max={100} value={brush.flow} defaultValue={60} onChange={(v) => setBrush({ flow: v })} />
        <Slider label={t('mask.brushDensity')} min={1} max={100} value={brush.density} defaultValue={100} onChange={(v) => setBrush({ density: v })} />
      </div>
    )
  }
  if (c.kind === 'radial') {
    return <Slider label={t('mask.feather')} min={0} max={100} value={c.feather} defaultValue={50} onChange={(v) => updateComponent(maskId, c.id, { feather: v })} onCommit={done('Radial Gradient')} />
  }
  if (c.kind === 'luminance') {
    const p = (k: 'lo' | 'hi' | 'smooth', label: TKey, def: number) => (
      <Slider label={t(label)} min={0} max={100} value={Math.round(c[k] * 100)} defaultValue={def} onChange={(v) => updateComponent(maskId, c.id, { [k]: v / 100 })} onCommit={done('Luminance range')} />
    )
    return (
      <div>
        {p('lo', 'mask.lumMin', 60)}
        {p('hi', 'mask.lumMax', 100)}
        {p('smooth', 'mask.lumSmooth', 10)}
      </div>
    )
  }
  if (c.kind === 'color') {
    const rgb = `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`
    return (
      <div>
        <div className="flex items-center gap-2 px-3 pb-1">
          <span className="size-6 rounded-[4px] border border-line-strong" style={{ background: rgb }} aria-hidden />
          <Button active={draw?.kind === 'colorpick' && draw.compId === c.id} onClick={() => setDraw(draw?.kind === 'colorpick' ? null : { kind: 'colorpick', maskId, compId: c.id })}>
            {t('mask.colorPick')}
          </Button>
        </div>
        <Slider label={t('mask.colorRange')} min={0} max={100} value={c.range} defaultValue={40} onChange={(v) => updateComponent(maskId, c.id, { range: v })} onCommit={done('Color range')} />
      </div>
    )
  }
  return null
}

export function MaskPanel() {
  const t = useT()
  const ready = usePanelReady()
  const masks = usePhotos((s) => (s.currentId ? s.params[s.currentId]?.masks : undefined)) ?? []
  const tool = useDevelop((s) => s.tool)
  const draw = useDevelop((s) => s.maskDraw)
  const maskSel = useDevelop((s) => s.maskSel)
  const compSel = useDevelop((s) => s.compSel)
  const overlay = useDevelop((s) => s.overlay)
  const aiBusy = useDevelop((s) => s.aiBusy)
  const { selectMask, setOverlay, setMaskDraw } = useDevelop.getState()

  const m = masks.find((x) => x.id === maskSel)
  const comp = m?.components.find((c) => c.id === compSel)
  const canBrush = typeof OffscreenCanvas !== 'undefined'
  const start = (kind: MaskKind) => {
    if (masks.length >= MAX_MASKS) return useToastStore.getState().push(t('mask.limit', { n: MAX_MASKS }), 'error')
    startMask(kind)
  }
  const hint = draw?.kind === 'brush' ? 'mask.hintBrush' : draw?.kind === 'linear' ? 'mask.hintLinear' : draw?.kind === 'radial' ? 'mask.hintRadial' : draw?.kind === 'colorpick' ? 'mask.hintPick' : null

  return (
    <div className="pb-2">
      <div className="flex flex-wrap gap-1 px-3 pb-1">
        {KINDS.map((k) => (
          <Button key={k} disabled={!ready || (k === 'brush' && !canBrush)} active={tool === 'mask' && draw?.kind === k && !draw.maskId} onClick={() => start(k)} className="!px-2 text-xs">
            {t(`mask.${k}` as TKey).replace(/ \(.+\)$/, '')}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1 px-3 pb-1">
        {(['subject', 'sky'] as const).map((k) => (
          <Button key={k} disabled={!ready || !canBrush || !!aiBusy} onClick={() => void runAiMask(k)} className="!px-2 text-xs" title={t(k === 'subject' ? 'ai.subjectNote' : 'ai.skyNote')}>
            {t(`mask.${k}` as TKey)}
          </Button>
        ))}
      </div>
      {aiBusy && <p className="px-3 pb-1 text-2xs text-accent" role="status">{aiBusy}</p>}
      {!canBrush && <p className="px-3 pb-1 text-2xs text-fg-2">{t('mask.disabledBrush')}</p>}
      {hint && <p className="px-3 pb-1 text-2xs text-accent">{t(hint)}</p>}

      {masks.length === 0 && <p className="px-3 py-1 text-xs text-fg-2">{t('mask.none')}</p>}
      <ul>
        {masks.map((x, i) => (
          <li key={x.id} className={`flex h-6 items-center gap-1 pr-2 pl-3 text-sm ${x.id === maskSel ? 'bg-bg-3 text-accent' : 'text-fg-1 hover:bg-bg-2'}`}>
            <button
              type="button"
              aria-pressed={x.visible}
              title={t('mask.show')}
              aria-label={t('mask.show')}
              className={`w-5 text-xs ${x.visible ? 'text-fg-0' : 'text-fg-2 line-through'}`}
              onClick={() => {
                updateMask(x.id, { visible: !x.visible })
                commitEdit('Mask')
              }}
            >
              ◉
            </button>
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left"
              onClick={() => {
                useDevelop.getState().setTool('mask')
                selectMask(x.id, x.components[0]?.id ?? null)
              }}
            >
              <span className="mr-1 font-mono text-2xs text-fg-2">{i + 1}</span>
              {x.name}
            </button>
          </li>
        ))}
      </ul>

      {m && (
        <>
          <Section title={t('mask.name')}>
            <div className="flex gap-1 px-3 pb-1">
              <input className="h-6 min-w-0 flex-1 rounded-[4px] border border-line bg-bg-2 px-2 text-sm" value={m.name} aria-label={t('mask.name')} onChange={(e) => updateMask(m.id, { name: e.target.value })} onBlur={() => commitEdit('Rename mask')} />
              <Button variant="ghost" title={t('mask.duplicate')} aria-label={t('mask.duplicate')} onClick={() => duplicateMask(m.id)}>
                ⧉
              </Button>
              <Button variant="ghost" title={t('mask.delete')} aria-label={t('mask.delete')} onClick={() => removeMask(m.id)}>
                ✕
              </Button>
            </div>
            <div className="flex items-center gap-3 px-3 pb-1 text-xs text-fg-1">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" className="accent-[var(--color-accent)]" checked={m.invert} onChange={(e) => { updateMask(m.id, { invert: e.target.checked }); commitEdit('Invert mask') }} />
                {t('mask.invert')}
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" className="accent-[var(--color-accent)]" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} />
                {t('mask.overlay')}
              </label>
            </div>
            <Slider label={t('mask.amount')} min={0} max={100} value={m.amount} defaultValue={100} onChange={(v) => updateMask(m.id, { amount: v })} onCommit={() => commitEdit('Mask amount')} />
          </Section>

          <Section title={t('mask.components')}>
            <ul>
              {m.components.map((c) => (
                <li key={c.id} className={`flex h-7 items-center gap-1 pr-2 pl-3 text-xs ${c.id === comp?.id ? 'bg-bg-2 text-fg-0' : 'text-fg-1 hover:bg-bg-2'}`}>
                  <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => { selectMask(m.id, c.id); setMaskDraw(null) }}>
                    {t(`mask.${c.kind}` as TKey).replace(/ \(.+\)$/, '')}
                  </button>
                  <select className={`${sel} w-[68px] shrink-0`} value={c.op} aria-label="op" onChange={(e) => { updateComponent(m.id, c.id, { op: e.target.value }); commitEdit('Mask') }}>
                    {OPS.map((o) => (
                      <option key={o} value={o}>
                        {t(opKey(o))}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    aria-pressed={c.invert}
                    title={t('mask.compInvert')}
                    aria-label={t('mask.compInvert')}
                    className={`h-5 w-5 shrink-0 rounded-[3px] border text-2xs ${c.invert ? 'border-accent text-accent' : 'border-line text-fg-2 hover:text-fg-0'}`}
                    onClick={() => {
                      updateComponent(m.id, c.id, { invert: !c.invert })
                      commitEdit('Mask')
                    }}
                  >
                    ⇄
                  </button>
                  <button type="button" aria-label={t('mask.delete')} className="text-fg-2 hover:text-danger disabled:opacity-30" disabled={m.components.length < 2} onClick={() => { removeComponent(m.id, c.id); commitEdit('Delete component') }}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-1 px-3 py-1">
              <span className="text-2xs text-fg-2">{t('mask.addComponent')}</span>
              {(['add', 'subtract', 'intersect'] as MaskOp[]).map((op) => (
                <select
                  key={op}
                  className={sel}
                  value=""
                  aria-label={`${t(opKey(op))}: ${t('mask.addComponent')}`}
                  onChange={(e) => {
                    const k = e.target.value
                    e.target.value = ''
                    if (k === 'ai:subject' || k === 'ai:sky') void runAiMask(k === 'ai:subject' ? 'subject' : 'sky', op, m.id)
                    else if (k) startMask(k as MaskKind, op, m.id)
                  }}
                >
                  <option value="">{t(opKey(op))} +</option>
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {t(`mask.${k}` as TKey).replace(/ \(.+\)$/, '')}
                    </option>
                  ))}
                  <option value="ai:subject">{t('mask.subject')}</option>
                  <option value="ai:sky">{t('mask.sky')}</option>
                </select>
              ))}
            </div>
            {comp && <ComponentParams maskId={m.id} c={comp} />}
          </Section>

          <Section title={t('mask.adjust')}>
            {ADJUST.map((a) => (
              <Slider
                key={a.key}
                label={t(`mask.${a.key}` as TKey)}
                min={a.min}
                max={a.max}
                step={a.step}
                value={m.adjust[a.key]}
                defaultValue={DEFAULT_MASK_ADJUST[a.key]}
                onChange={(v) => setAdjust(m.id, a.key, v)}
                onCommit={() => commitEdit(`${m.name}: ${t(`mask.${a.key}` as TKey)}`)}
              />
            ))}
            <div className="px-3 pt-1">
              <Button
                className="w-full"
                onClick={() => {
                  updateMask(m.id, { adjust: { ...DEFAULT_MASK_ADJUST } })
                  commitEdit('Reset mask')
                }}
              >
                {t('basic.resetAll')}
              </Button>
            </div>
          </Section>
        </>
      )}
    </div>
  )
}
