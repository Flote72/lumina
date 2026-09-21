import { useRef } from 'react'
import {
  cropToFrameRect,
  frameRectToCrop,
  isInside,
  ratioValue,
  translateInside,
  type FrameRect,
} from '@/core/geometry/crop'
import type { CropParams } from '@/core/params/params'
import { useDevelop, type GuideKind } from '@/store/develop'
import { usePhotos } from '@/store/photos'

type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const MIN = 24

interface Props {
  W: number
  H: number
  crop: CropParams
  /** CSS px */
  vw: number
  vh: number
  /** CSS px per frame px, and CSS pan */
  zCss: number
  panX: number
  panY: number
}

function resize(h: Handle, r: FrameRect, dx: number, dy: number, ratio: number | null): FrameRect {
  let left = r.cx - r.w / 2
  let right = r.cx + r.w / 2
  let top = r.cy - r.h / 2
  let bottom = r.cy + r.h / 2
  if (h.includes('w')) left += dx
  if (h.includes('e')) right += dx
  if (h.includes('n')) top += dy
  if (h.includes('s')) bottom += dy
  if (ratio) {
    const isCorner = h.length === 2
    if (isCorner) {
      const w = Math.max(MIN, right - left)
      const hh = w / ratio
      if (h.includes('w')) left = right - w
      else right = left + w
      if (h.includes('n')) top = bottom - hh
      else bottom = top + hh
    } else if (h === 'e' || h === 'w') {
      const w = Math.max(MIN, right - left)
      const hh = w / ratio
      const cy = r.cy
      if (h === 'w') left = right - w
      else right = left + w
      top = cy - hh / 2
      bottom = cy + hh / 2
    } else {
      const hh = Math.max(MIN, bottom - top)
      const w = hh * ratio
      const cx = r.cx
      if (h === 'n') top = bottom - hh
      else bottom = top + hh
      left = cx - w / 2
      right = cx + w / 2
    }
  }
  return { cx: (left + right) / 2, cy: (top + bottom) / 2, w: Math.max(MIN, right - left), h: Math.max(MIN, bottom - top) }
}

function Guides({ kind, x, y, w, h }: { kind: GuideKind; x: number; y: number; w: number; h: number }) {
  const lines: [number, number, number, number][] = []
  const v = (f: number) => lines.push([x + w * f, y, x + w * f, y + h])
  const hz = (f: number) => lines.push([x, y + h * f, x + w, y + h * f])
  const both = (f: number) => {
    v(f)
    hz(f)
  }
  if (kind === 'thirds') [1 / 3, 2 / 3].forEach(both)
  if (kind === 'golden') [0.382, 0.618].forEach(both)
  if (kind === 'grid') for (let i = 1; i < 6; i++) both(i / 6)
  if (kind === 'diagonal') lines.push([x, y, x + w, y + h], [x + w, y, x, y + h])
  return (
    <g stroke="rgba(255,255,255,0.55)" strokeWidth={1}>
      {lines.map((l, i) => (
        <line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} />
      ))}
    </g>
  )
}

export function CropOverlay({ W, H, crop, vw, vh, zCss, panX, panY }: Props) {
  const edit = usePhotos((s) => s.edit)
  const commit = usePhotos((s) => s.commit)
  const guide = useDevelop((s) => s.guide)
  const drag = useRef<{ h: Handle; sx: number; sy: number; rect: FrameRect } | null>(null)

  const r = cropToFrameRect(crop, W, H)
  const sx = (fx: number) => vw / 2 + panX + fx * zCss
  const sy = (fy: number) => vh / 2 + panY + fy * zCss
  const x = sx(r.cx - r.w / 2)
  const y = sy(r.cy - r.h / 2)
  const w = r.w * zCss
  const h = r.h * zCss

  const onDown = (e: React.PointerEvent, handle: Handle) => {
    if (e.button !== 0) return
    e.stopPropagation()
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    drag.current = { h: handle, sx: e.clientX, sy: e.clientY, rect: r }
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = (e.clientX - d.sx) / zCss
    const dy = (e.clientY - d.sy) / zCss
    let next: FrameRect
    if (d.h === 'move') {
      next = translateInside({ ...d.rect, cx: d.rect.cx + dx, cy: d.rect.cy + dy }, crop.angle, W, H)
    } else {
      next = resize(d.h, d.rect, dx, dy, ratioValue(crop.ratio, W, H))
      if (!isInside(next, crop.angle, W, H)) return
    }
    edit((p) => ({ ...p, crop: frameRectToCrop(next, p.crop.angle, p.crop.ratio, W, H) }))
  }
  const onUp = () => {
    if (!drag.current) return
    drag.current = null
    commit('Crop')
  }

  const pos: Record<Exclude<Handle, 'move'>, [number, number]> = {
    nw: [x, y],
    n: [x + w / 2, y],
    ne: [x + w, y],
    e: [x + w, y + h / 2],
    se: [x + w, y + h],
    s: [x + w / 2, y + h],
    sw: [x, y + h],
    w: [x, y + h / 2],
  }
  const cursor: Record<string, string> = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' }

  return (
    <svg className="absolute inset-0 size-full" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <path d={`M0 0H${vw}V${vh}H0Z M${x} ${y}H${x + w}V${y + h}H${x}Z`} fill="rgba(0,0,0,0.6)" fillRule="evenodd" pointerEvents="none" />
      <Guides kind={guide} x={x} y={y} w={w} h={h} />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="transparent"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth={1}
        style={{ cursor: 'move' }}
        onPointerDown={(e) => onDown(e, 'move')}
      />
      {HANDLES.map((k) => (
        <rect
          key={k}
          x={pos[k as Exclude<Handle, 'move'>][0] - 5}
          y={pos[k as Exclude<Handle, 'move'>][1] - 5}
          width={10}
          height={10}
          rx={1.5}
          fill="#1b1b1b"
          stroke="#fff"
          strokeWidth={1.2}
          style={{ cursor: cursor[k] }}
          onPointerDown={(e) => onDown(e, k)}
        />
      ))}
    </svg>
  )
}
