import { rotate } from '@/core/geometry/crop'
import { useT } from '@/i18n'
import { useDevelop } from '@/store/develop'
import { usePhotos } from '@/store/photos'
import { useViewInfo } from './viewStore'

export function Navigator() {
  const t = useT()
  const photo = usePhotos((s) => (s.currentId ? s.photos[s.currentId] : undefined))
  const crop = usePhotos((s) => (s.currentId ? s.params[s.currentId]?.crop : undefined))
  const v = useViewInfo()
  const cropEdit = useDevelop((s) => s.cropEdit)

  if (!photo?.thumbUrl || !crop || !photo.width) {
    return <p className="px-3 py-1 text-xs text-fg-2">{t('basic.noPhoto')}</p>
  }
  const { width: W, height: H } = photo
  const C: [number, number] = cropEdit ? [W / 2, H / 2] : [crop.cx * W, crop.cy * H]
  const a = (crop.angle * Math.PI) / 180
  const zoomedIn = v.zoom > v.fit * 1.001

  const toSource = (vx: number, vy: number): [number, number] => {
    const o: [number, number] = [(vx - v.vw / 2 - v.x) / v.zoom, (vy - v.vh / 2 - v.y) / v.zoom]
    const r = rotate(o, -a)
    return [C[0] + r[0], C[1] + r[1]]
  }
  const poly = [toSource(0, 0), toSource(v.vw, 0), toSource(v.vw, v.vh), toSource(0, v.vh)].map((p) => p.join(',')).join(' ')

  const recenter = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!zoomedIn || !(e.buttons & 1)) return
    const r = e.currentTarget.getBoundingClientRect()
    const p: [number, number] = [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]
    const o = rotate([p[0] - C[0], p[1] - C[1]], a)
    useDevelop.getState().setView(v.zoom, { x: -o[0] * v.zoom, y: -o[1] * v.zoom })
  }

  return (
    <div className="px-3 pb-1">
      <div className="relative overflow-hidden rounded-[3px] border border-line bg-bg-0" style={{ aspectRatio: `${W} / ${H}` }}>
        <img src={photo.thumbUrl} alt="" draggable={false} className="absolute inset-0 size-full object-fill" />
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="absolute inset-0 size-full"
          style={{ cursor: zoomedIn ? 'pointer' : 'default' }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            recenter(e)
          }}
          onPointerMove={recenter}
        >
          <polygon points={poly} fill="rgba(232,163,61,0.10)" stroke="var(--color-accent)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="mt-1 text-right font-mono text-2xs text-fg-2 tabular-nums">{Math.round(v.zoom * 100)}%</div>
    </div>
  )
}
