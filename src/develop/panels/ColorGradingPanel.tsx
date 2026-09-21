import { useRef, useState } from 'react'
import type { Wheel } from '@/core/params/params'
import { useT, type TKey } from '@/i18n'
import { usePhotos } from '@/store/photos'
import { ParamSlider, ResetButton, SubHeader, Tabs } from './kit'
import { usePanelReady } from './usePanelReady'

type Region = 'shadows' | 'midtones' | 'highlights' | 'global'
const R = 64
const RAINBOW = 'linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)'

function ColorWheel({ region }: { region: Region }) {
  const t = useT()
  const ready = usePanelReady()
  const w = usePhotos((s) => (s.currentId ? s.params[s.currentId]?.grading[region] : undefined)) as Wheel | undefined
  const edit = usePhotos((s) => s.edit)
  const commit = usePhotos((s) => s.commit)
  const box = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  if (!w) return null

  const set = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top + r.height / 2)
    const s = Math.min(100, (Math.hypot(dx, dy) / (r.width / 2)) * 100)
    // hue 0° at the top, clockwise (matches the conic gradient below)
    const h = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360
    edit((p) => ({ ...p, grading: { ...p.grading, [region]: { ...p.grading[region], h: Math.round(h), s: Math.round(s) } } }))
  }
  const rad = (w.h * Math.PI) / 180
  const px = Math.sin(rad) * (w.s / 100) * R
  const py = -Math.cos(rad) * (w.s / 100) * R

  return (
    <div className="flex justify-center py-1">
      <div
        ref={box}
        role="application"
        aria-label={`${t(`grade.${region}` as TKey)}: ${t('grade.hue')} ${w.h}°, ${t('grade.sat')} ${w.s}`}
        tabIndex={ready ? 0 : -1}
        className="relative touch-none rounded-full border border-line-strong"
        style={{
          width: R * 2,
          height: R * 2,
          opacity: ready ? 1 : 0.5,
          background: 'radial-gradient(circle, #808080 0%, transparent 70%), conic-gradient(from 0deg, #f33, #ff3, #3f3, #3ff, #33f, #f3f, #f33)',
          cursor: 'crosshair',
        }}
        onPointerDown={(e) => {
          if (!ready) return
          e.currentTarget.setPointerCapture(e.pointerId)
          dragging.current = true
          set(e)
        }}
        onPointerMove={(e) => dragging.current && set(e)}
        onPointerUp={() => {
          if (!dragging.current) return
          dragging.current = false
          commit(t('panel.colorGrading'))
        }}
        onDoubleClick={() => {
          edit((p) => ({ ...p, grading: { ...p.grading, [region]: { ...p.grading[region], h: 0, s: 0 } } }))
          commit(t('panel.colorGrading'))
        }}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 10 : 2
          const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }
          const m = d[e.key]
          if (!m) return
          e.preventDefault()
          e.stopPropagation()
          edit((p) => {
            const c = p.grading[region]
            return { ...p, grading: { ...p.grading, [region]: { ...c, h: (c.h + m[0] + 360) % 360, s: Math.min(100, Math.max(0, c.s + m[1])) } } }
          })
          commit(t('panel.colorGrading'))
        }}
      >
        <span
          aria-hidden
          className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: R + px, top: R + py, background: `hsl(${w.h} ${w.s}% 50%)` }}
        />
      </div>
    </div>
  )
}

export function ColorGradingPanel() {
  const t = useT()
  const [region, setRegion] = useState<Region>('shadows')
  const items = (['shadows', 'midtones', 'highlights', 'global'] as const).map((id) => ({ id, label: t(`grade.${id}` as TKey) }))
  const P = ['grading', region] as const
  return (
    <div>
      <SubHeader right={<ResetButton sections={['grading']} label={t('grade.reset')} />}>{t(`grade.${region}` as TKey)}</SubHeader>
      <Tabs value={region} onChange={setRegion} items={items} />
      <ColorWheel region={region} />
      <ParamSlider key={`${region}.h`} path={[...P, 'h']} label={t('grade.hue')} min={0} max={360} bg={RAINBOW} history={t('panel.colorGrading')} />
      <ParamSlider key={`${region}.s`} path={[...P, 's']} label={t('grade.sat')} min={0} max={100} history={t('panel.colorGrading')} />
      <ParamSlider key={`${region}.l`} path={[...P, 'l']} label={t('grade.lum')} min={-100} max={100} history={t('panel.colorGrading')} />
      <ParamSlider path={['grading', 'blending']} label={t('grade.blending')} min={0} max={100} history={t('panel.colorGrading')} />
      <ParamSlider path={['grading', 'balance']} label={t('grade.balance')} min={-100} max={100} history={t('panel.colorGrading')} />
    </div>
  )
}
