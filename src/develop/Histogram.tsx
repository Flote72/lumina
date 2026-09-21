import { useEffect, useRef } from 'react'
import { useT } from '@/i18n'
import { useDevelop } from '@/store/develop'
import { useHistogram } from './histogramStore'

const W = 256
const H = 100

export function HistogramPanel() {
  const t = useT()
  const data = useHistogram((s) => s.data)
  const readout = useDevelop((s) => s.readout)
  const clipping = useDevelop((s) => s.clipping)
  const toggle = useDevelop((s) => s.toggleClipping)
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const g = c.getContext('2d')!
    g.clearRect(0, 0, W, H)
    g.strokeStyle = '#2c2c2c'
    g.lineWidth = 1
    for (let i = 1; i < 4; i++) {
      g.beginPath()
      g.moveTo((W * i) / 4 + 0.5, 0)
      g.lineTo((W * i) / 4 + 0.5, H)
      g.stroke()
    }
    if (!data) return
    let max = 1
    for (const ch of [data.r, data.g, data.b, data.l]) for (let i = 1; i < 255; i++) max = Math.max(max, ch[i]!)
    const plot = (ch: Uint32Array, fill: string) => {
      g.fillStyle = fill
      g.beginPath()
      g.moveTo(0, H)
      for (let i = 0; i < 256; i++) g.lineTo(i, H - Math.min(1, Math.sqrt(ch[i]! / max)) * (H - 2))
      g.lineTo(255, H)
      g.closePath()
      g.fill()
    }
    plot(data.l, 'rgba(200,200,200,0.35)')
    g.globalCompositeOperation = 'lighter'
    plot(data.r, 'rgba(230,60,60,0.55)')
    plot(data.g, 'rgba(60,200,80,0.55)')
    plot(data.b, 'rgba(70,110,240,0.55)')
    g.globalCompositeOperation = 'source-over'
  }, [data])

  const total = data ? data.l.reduce((a, b) => a + b, 0) || 1 : 1
  const shadowClip = data ? (data.r[0]! + data.g[0]! + data.b[0]!) / 3 / total > 0.005 : false
  const highClip = data ? (data.r[255]! + data.g[255]! + data.b[255]!) / 3 / total > 0.005 : false

  return (
    <div className="px-3 pb-1">
      <div className="relative overflow-hidden rounded-[3px] border border-line bg-bg-0">
        <canvas ref={ref} width={W} height={H} className="block h-[100px] w-full" role="img" aria-label={t('panel.histogram')} />
        <button
          type="button"
          onClick={toggle}
          aria-pressed={clipping}
          title={t('hist.clipShadow')}
          className="absolute top-1 left-1 size-3 rounded-[2px] border border-line-strong"
          style={{ background: shadowClip ? '#3a6df0' : 'transparent', outline: clipping ? '1px solid var(--color-accent)' : undefined }}
        />
        <button
          type="button"
          onClick={toggle}
          aria-pressed={clipping}
          title={t('hist.clipHighlight')}
          className="absolute top-1 right-1 size-3 rounded-[2px] border border-line-strong"
          style={{ background: highClip ? '#e5443a' : 'transparent', outline: clipping ? '1px solid var(--color-accent)' : undefined }}
        />
      </div>
      <div className="mt-1 flex h-4 items-center justify-center gap-3 font-mono text-2xs text-fg-2 tabular-nums">
        {readout ? (
          <>
            <span style={{ color: '#e07070' }}>R {Math.round((readout[0] / 255) * 100)}</span>
            <span style={{ color: '#70c880' }}>G {Math.round((readout[1] / 255) * 100)}</span>
            <span style={{ color: '#7f9af0' }}>B {Math.round((readout[2] / 255) * 100)}</span>
            <span>%</span>
          </>
        ) : (
          <span>{t('rgb.label')}</span>
        )}
      </div>
    </div>
  )
}
