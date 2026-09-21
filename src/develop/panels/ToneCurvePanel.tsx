import { useRef, useState } from 'react'
import { monotoneSpline } from '@/core/curve/curve'
import { type CurveChannel, type CurvePoint } from '@/core/params/params'
import { useT, type TKey } from '@/i18n'
import { usePhotos } from '@/store/photos'
import { ParamSlider, ResetButton, SubHeader, Tabs } from './kit'
import { usePanelReady } from './usePanelReady'

const SIZE = 216
const PAD = 6
const IN = SIZE - PAD * 2
const CH_COLOR: Record<CurveChannel, string> = { rgb: '#d8d8d8', r: '#e5544a', g: '#4cc060', b: '#5b82f0' }
const MIN_GAP = 0.01

const toX = (x: number) => PAD + x * IN
const toY = (y: number) => PAD + (1 - y) * IN

function CurveEditor() {
  const t = useT()
  const ready = usePanelReady()
  const [ch, setCh] = useState<CurveChannel>('rgb')
  const pts = usePhotos((s) => (s.currentId ? s.params[s.currentId]?.toneCurve.points[ch] : undefined)) ?? []
  const edit = usePhotos((s) => s.edit)
  const commit = usePhotos((s) => s.commit)
  const svg = useRef<SVGSVGElement>(null)
  const drag = useRef<number | null>(null)

  const setPts = (next: CurvePoint[]) =>
    edit((p) => ({ ...p, toneCurve: { ...p.toneCurve, points: { ...p.toneCurve.points, [ch]: next } } }))

  const fromEvent = (e: React.PointerEvent | React.MouseEvent) => {
    const r = svg.current!.getBoundingClientRect()
    const k = SIZE / r.width
    return {
      x: Math.min(1, Math.max(0, ((e.clientX - r.left) * k - PAD) / IN)),
      y: Math.min(1, Math.max(0, 1 - ((e.clientY - r.top) * k - PAD) / IN)),
    }
  }

  const move = (i: number, x: number, y: number) => {
    const last = pts.length - 1
    const nx = i === 0 || i === last ? pts[i]!.x : Math.min(pts[i + 1]!.x - MIN_GAP, Math.max(pts[i - 1]!.x + MIN_GAP, x))
    setPts(pts.map((p, k) => (k === i ? { x: nx, y } : p)))
  }

  const onBackgroundDown = (e: React.PointerEvent) => {
    if (!ready || e.button !== 0) return
    const { x, y } = fromEvent(e)
    if (pts.some((p) => Math.abs(p.x - x) < MIN_GAP * 2)) return
    const next = [...pts, { x, y }].sort((a, b) => a.x - b.x)
    setPts(next)
    drag.current = next.findIndex((p) => p.x === x)
    svg.current!.setPointerCapture(e.pointerId)
  }
  const onPointDown = (e: React.PointerEvent, i: number) => {
    if (!ready || e.button !== 0) return
    e.stopPropagation()
    drag.current = i
    svg.current!.setPointerCapture(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    if (drag.current === null) return
    const { x, y } = fromEvent(e)
    move(drag.current, x, y)
  }
  const onUp = () => {
    if (drag.current === null) return
    drag.current = null
    commit(t('curve.point'))
  }
  const remove = (i: number) => {
    if (pts.length <= 2) return
    setPts(pts.filter((_, k) => k !== i))
    commit(t('curve.point'))
  }
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.shiftKey ? 0.05 : 0.01
    const p = pts[i]!
    const map: Record<string, [number, number]> = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, d], ArrowDown: [0, -d] }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      remove(i)
    } else if (map[e.key]) {
      e.preventDefault()
      e.stopPropagation()
      const [dx, dy] = map[e.key]!
      move(i, Math.min(1, Math.max(0, p.x + dx)), Math.min(1, Math.max(0, p.y + dy)))
      commit(t('curve.point'))
    }
  }

  const f = monotoneSpline(pts)
  const path = Array.from({ length: 65 }, (_, k) => {
    const x = k / 64
    return `${k ? 'L' : 'M'}${toX(x).toFixed(1)} ${toY(f(x)).toFixed(1)}`
  }).join(' ')

  return (
    <div className="px-3 pb-1">
      <Tabs
        value={ch}
        onChange={setCh}
        items={[
          { id: 'rgb', label: 'RGB' },
          { id: 'r', label: 'R' },
          { id: 'g', label: 'G' },
          { id: 'b', label: 'B' },
        ]}
      />
      <svg
        ref={svg}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="block w-full touch-none rounded-[3px] border border-line bg-bg-0"
        style={{ aspectRatio: '1', opacity: ready ? 1 : 0.5 }}
        onPointerDown={onBackgroundDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        role="group"
        aria-label={t('curve.point')}
      >
        {[1, 2, 3].map((i) => (
          <g key={i} stroke="#2c2c2c">
            <line x1={toX(i / 4)} y1={PAD} x2={toX(i / 4)} y2={SIZE - PAD} />
            <line x1={PAD} y1={toY(i / 4)} x2={SIZE - PAD} y2={toY(i / 4)} />
          </g>
        ))}
        <line x1={toX(0)} y1={toY(0)} x2={toX(1)} y2={toY(1)} stroke="#3d3d3d" strokeDasharray="3 3" />
        <path d={path} fill="none" stroke={CH_COLOR[ch]} strokeWidth={1.6} />
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={toX(p.x)}
            cy={toY(p.y)}
            r={5}
            fill="#1b1b1b"
            stroke={CH_COLOR[ch]}
            strokeWidth={1.6}
            tabIndex={ready ? 0 : -1}
            role="slider"
            aria-label={`${t('curve.point')} ${i + 1}`}
            aria-valuetext={`${Math.round(p.x * 255)} → ${Math.round(p.y * 255)}`}
            style={{ cursor: 'grab' }}
            onPointerDown={(e) => onPointDown(e, i)}
            onDoubleClick={() => remove(i)}
            onKeyDown={(e) => onKey(e, i)}
          />
        ))}
      </svg>
      <p className="mt-1 text-2xs text-fg-2">{t('curve.hint')}</p>
    </div>
  )
}

export function ToneCurvePanel() {
  const t = useT()
  const P = ['toneCurve', 'parametric'] as const
  const row = (k: 'highlights' | 'lights' | 'darks' | 'shadows') => (
    <ParamSlider key={k} path={[...P, k]} label={t(`curve.${k}` as TKey)} min={-100} max={100} history={t('panel.toneCurve')} />
  )
  return (
    <div>
      <SubHeader right={<ResetButton sections={['toneCurve']} label={t('curve.reset')} />}>{t('curve.parametric')}</SubHeader>
      {(['highlights', 'lights', 'darks', 'shadows'] as const).map(row)}
      <ParamSlider path={[...P, 'split1']} label={t('curve.split1')} min={5} max={90} constrain={(v, p) => Math.min(v, p.toneCurve.parametric.split2 - 5)} history={t('panel.toneCurve')} />
      <ParamSlider path={[...P, 'split2']} label={t('curve.split2')} min={10} max={95} constrain={(v, p) => Math.max(p.toneCurve.parametric.split1 + 5, Math.min(v, p.toneCurve.parametric.split3 - 5))} history={t('panel.toneCurve')} />
      <ParamSlider path={[...P, 'split3']} label={t('curve.split3')} min={15} max={95} constrain={(v, p) => Math.max(v, p.toneCurve.parametric.split2 + 5)} history={t('panel.toneCurve')} />
      <SubHeader>{t('curve.point')}</SubHeader>
      <CurveEditor />
    </div>
  )
}
