import { useRef, useState } from 'react'
import { sourceToViewport, viewportToSource, type MapParams } from '@/core/geometry/map'
import { linearToSrgb } from '@/core/color/srgb'
import { maskAnchor } from '@/core/mask/create'
import { estimateRedEye, suggestSource, type Gray } from '@/core/retouch/suggest'
import type { Mask, MaskComponent, RedEye, Spot } from '@/core/params/params'
import { renderClient } from '@/render/client'
import { useDevelop } from '@/store/develop'
import { usePhotos } from '@/store/photos'
import {
  addComponent,
  addRedEye,
  addSpot,
  beginStroke,
  createMask,
  extendStroke,
  updateComponent,
  updateRedEye,
  updateSpot,
} from './maskActions'
import { getPreview } from './previewImage'

interface Props {
  map: MapParams
  dpr: number
  /** css size of the viewport */
  vw: number
  vh: number
}

type Drag =
  | { type: 'stroke'; maskId: string; compId: string; last: [number, number] }
  | { type: 'newLinear'; maskId: string; compId: string; start: [number, number] }
  | { type: 'newRadial'; maskId: string; compId: string; center: [number, number] }
  | { type: 'lin0' | 'lin1'; maskId: string; compId: string }
  | { type: 'linMove'; maskId: string; compId: string; start: [number, number]; orig: [number, number, number, number] }
  | { type: 'radMove'; maskId: string; compId: string; start: [number, number]; orig: [number, number] }
  | { type: 'radX' | 'radY' | 'radRot'; maskId: string; compId: string }
  | { type: 'spotDest'; id: string; start: [number, number]; orig: [number, number] }
  | { type: 'spotSrc'; id: string; start: [number, number]; orig: [number, number] }
  | { type: 'spotRadius' | 'newSpot'; id: string }
  | { type: 'eyeMove'; id: string; start: [number, number]; orig: [number, number] }
  | { type: 'eyeRadius'; id: string }

const ACCENT = 'var(--color-accent)'
const HANDLE = 5
const rot = (x: number, y: number, a: number): [number, number] => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]

/** Interactive overlay for masks, spot removal and red-eye. Everything is drawn in CSS px over the canvas. */
export function LocalOverlay({ map, dpr, vw, vh }: Props) {
  const tool = useDevelop((s) => s.tool)
  const draw = useDevelop((s) => s.maskDraw)
  const maskSel = useDevelop((s) => s.maskSel)
  const compSel = useDevelop((s) => s.compSel)
  const brush = useDevelop((s) => s.brush)
  const spotSel = useDevelop((s) => s.spotSel)
  const redSel = useDevelop((s) => s.redSel)
  const id = usePhotos((s) => s.currentId)!
  const params = usePhotos((s) => s.params[s.currentId!])
  const commit = usePhotos((s) => s.commit)
  const svg = useRef<SVGSVGElement>(null)
  const drag = useRef<Drag | null>(null)
  const [cursor, setCursor] = useState<[number, number] | null>(null)

  const { W, H } = map
  const L = Math.max(W, H)
  const masks = params?.masks ?? []
  const spots = params?.spots ?? []
  const eyes = params?.redEyes ?? []
  const pxPerSrc = (map.zoom * (map.transform.scale / 100)) / dpr // css px per source px (approximate)

  const toN = (cx: number, cy: number): [number, number] => {
    const [x, y] = viewportToSource(cx * dpr, cy * dpr, map)
    return [x / W, y / H]
  }
  const fromN = (nx: number, ny: number): [number, number] => {
    const [x, y] = sourceToViewport(nx * W, ny * H, map)
    return [x / dpr, y / dpr]
  }
  const fromPx = (x: number, y: number) => fromN(x / W, y / H)
  const local = (e: React.PointerEvent): [number, number] => {
    const r = svg.current!.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }
  const finish = (label: string) => {
    drag.current = null
    commit(label)
  }

  // ---- background: create things ---------------------------------------------------------------------
  const onBackgroundDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || e.altKey && tool !== 'mask') return
    const [cx, cy] = local(e)
    const [nx, ny] = toN(cx, cy)
    svg.current!.setPointerCapture(e.pointerId)
    e.stopPropagation()

    if (tool === 'mask' && draw) {
      if (draw.kind === 'colorpick') {
        void renderClient.probeWork(Math.round(cx * dpr), Math.round(cy * dpr)).then((rgb) => {
          if (!rgb) return
          updateComponent(draw.maskId, draw.compId, { r: linearToSrgb(rgb[0]), g: linearToSrgb(rgb[1]), b: linearToSrgb(rgb[2]) })
          commit('Color range')
          useDevelop.getState().setMaskDraw(null)
        })
        return
      }
      // find / create the target mask + component
      let maskId = draw.maskId
      let compId: string | null
      if (maskId) {
        const m = masks.find((x) => x.id === maskId)
        const sel = m?.components.find((c) => c.id === compSel)
        if (draw.kind === 'brush' && sel?.kind === 'brush') compId = sel.id
        else compId = addComponent(maskId, draw.kind, draw.op)
      } else {
        const made = createMask(draw.kind)
        if (!made) return
        maskId = made.maskId
        compId = made.compId
        if (draw.kind === 'brush') useDevelop.getState().setMaskDraw({ ...draw, maskId })
      }
      if (!compId) return
      if (draw.kind === 'brush') {
        beginStroke(maskId, compId, nx, ny, brush.erase || e.altKey)
        drag.current = { type: 'stroke', maskId, compId, last: [cx, cy] }
        setCursor([cx, cy])
      } else if (draw.kind === 'linear') {
        updateComponent(maskId, compId, { x0: nx, y0: ny, x1: nx, y1: ny })
        drag.current = { type: 'newLinear', maskId, compId, start: [cx, cy] }
      } else {
        updateComponent(maskId, compId, { cx: nx, cy: ny, rx: 0.02, ry: 0.02, angle: 0 })
        drag.current = { type: 'newRadial', maskId, compId, center: [nx, ny] }
      }
    } else if (tool === 'spot') {
      const s = useDevelop.getState().spot
      const offset = Math.min(0.2, s.radius * 3.2)
      const spotId = addSpot({ mode: s.mode, x: nx, y: ny, sx: Math.min(1, nx + offset * (H / W)), sy: ny, radius: s.radius, feather: s.feather, opacity: s.opacity })
      if (spotId) drag.current = { type: 'newSpot', id: spotId }
    } else if (tool === 'redeye') {
      const r = useDevelop.getState().red
      void getPreview(id).then((pv) => {
        const found = estimateRedEye({ data: pv.rgba, w: pv.w, h: pv.h }, nx, ny)
        addRedEye({ x: found?.x ?? nx, y: found?.y ?? ny, radius: found ? Math.max(found.radius, 0.004) : 0.012, pupil: r.pupil, darken: r.darken })
        commit('Red-eye')
      })
    }
  }

  // ---- moves -----------------------------------------------------------------------------------------------
  const onMove = (e: React.PointerEvent) => {
    const [cx, cy] = local(e)
    if (tool === 'mask' && draw?.kind === 'brush') setCursor([cx, cy])
    const d = drag.current
    if (!d) return
    const [nx, ny] = toN(cx, cy)
    const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
    switch (d.type) {
      case 'stroke': {
        if (Math.hypot(cx - d.last[0], cy - d.last[1]) < 1.5) return
        extendStroke(d.maskId, d.compId, nx, ny)
        d.last = [cx, cy]
        break
      }
      case 'newLinear':
        updateComponent(d.maskId, d.compId, { x1: nx, y1: ny })
        break
      case 'newRadial': {
        const dist = Math.hypot((nx - d.center[0]) * W, (ny - d.center[1]) * H) / L
        updateComponent(d.maskId, d.compId, { rx: Math.max(0.005, dist), ry: Math.max(0.005, dist) })
        break
      }
      case 'lin0':
        updateComponent(d.maskId, d.compId, { x0: nx, y0: ny })
        break
      case 'lin1':
        updateComponent(d.maskId, d.compId, { x1: nx, y1: ny })
        break
      case 'linMove': {
        const dx = nx - d.start[0]
        const dy = ny - d.start[1]
        updateComponent(d.maskId, d.compId, { x0: d.orig[0] + dx, y0: d.orig[1] + dy, x1: d.orig[2] + dx, y1: d.orig[3] + dy })
        break
      }
      case 'radMove':
        updateComponent(d.maskId, d.compId, { cx: d.orig[0] + nx - d.start[0], cy: d.orig[1] + ny - d.start[1] })
        break
      case 'radX':
      case 'radY':
      case 'radRot': {
        const c = masks.find((m) => m.id === d.maskId)?.components.find((k) => k.id === d.compId)
        if (c?.kind !== 'radial') return
        const dx = nx * W - c.cx * W
        const dy = ny * H - c.cy * H
        const [lx, ly] = rot(dx, dy, -c.angle)
        if (d.type === 'radX') updateComponent(d.maskId, d.compId, { rx: Math.max(0.005, Math.abs(lx) / L) })
        else if (d.type === 'radY') updateComponent(d.maskId, d.compId, { ry: Math.max(0.005, Math.abs(ly) / L) })
        else updateComponent(d.maskId, d.compId, { angle: Math.atan2(dy, dx) })
        break
      }
      case 'spotDest':
        updateSpot(d.id, { x: clamp01(d.orig[0] + nx - d.start[0]), y: clamp01(d.orig[1] + ny - d.start[1]) })
        break
      case 'spotSrc':
        updateSpot(d.id, { sx: clamp01(d.orig[0] + nx - d.start[0]), sy: clamp01(d.orig[1] + ny - d.start[1]) })
        break
      case 'newSpot':
      case 'spotRadius': {
        const s = spots.find((x) => x.id === d.id)
        if (!s) return
        const r = Math.hypot((nx - s.x) * W, (ny - s.y) * H) / L
        if (d.type === 'spotRadius' || r > 0.004) updateSpot(d.id, { radius: Math.min(0.2, Math.max(0.004, r)) })
        break
      }
      case 'eyeMove':
        updateRedEye(d.id, { x: clamp01(d.orig[0] + nx - d.start[0]), y: clamp01(d.orig[1] + ny - d.start[1]) })
        break
      case 'eyeRadius': {
        const r = eyes.find((x) => x.id === d.id)
        if (!r) return
        updateRedEye(d.id, { radius: Math.min(0.1, Math.max(0.002, Math.hypot((nx - r.x) * W, (ny - r.y) * H) / L)) })
        break
      }
    }
  }

  const onUp = () => {
    const d = drag.current
    if (!d) return
    switch (d.type) {
      case 'stroke':
        return finish('Brush')
      case 'newLinear': {
        const c = masks.find((m) => m.id === d.maskId)?.components.find((k) => k.id === d.compId)
        if (c?.kind === 'linear' && Math.hypot((c.x1 - c.x0) * W, (c.y1 - c.y0) * H) * pxPerSrc < 10) {
          updateComponent(d.maskId, d.compId, { x0: c.x0, y0: Math.max(0, c.y0 - 0.15), x1: c.x0, y1: Math.min(1, c.y0 + 0.15) })
        }
        useDevelop.getState().setMaskDraw(null)
        return finish('Linear Gradient')
      }
      case 'newRadial': {
        const c = masks.find((m) => m.id === d.maskId)?.components.find((k) => k.id === d.compId)
        if (c?.kind === 'radial' && c.rx * L * pxPerSrc < 6) updateComponent(d.maskId, d.compId, { rx: 0.15, ry: 0.15 })
        useDevelop.getState().setMaskDraw(null)
        return finish('Radial Gradient')
      }
      case 'lin0':
      case 'lin1':
      case 'linMove':
        return finish('Linear Gradient')
      case 'radMove':
      case 'radX':
      case 'radY':
      case 'radRot':
        return finish('Radial Gradient')
      case 'newSpot': {
        const sid = d.id
        drag.current = null
        const s = usePhotos.getState().params[id]?.spots.find((x) => x.id === sid)
        if (!s) return
        void getPreview(id)
          .then((pv) => {
            const cur = usePhotos.getState().params[id]?.spots.find((x) => x.id === sid)
            if (!cur) return
            const sug = suggestSource({ data: pv.gray, w: pv.w, h: pv.h } as Gray, cur.x, cur.y, cur.radius)
            updateSpot(sid, { sx: sug.x, sy: sug.y })
          })
          .catch(() => {})
          .finally(() => commit('Spot'))
        return
      }
      case 'spotDest':
      case 'spotSrc':
      case 'spotRadius':
        return finish('Spot')
      case 'eyeMove':
      case 'eyeRadius':
        return finish('Red-eye')
    }
  }

  const start = (d: Drag) => (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    svg.current!.setPointerCapture(e.pointerId)
    drag.current = d
  }

  // ---- drawing helpers ---------------------------------------------------------------------------------------
  const handle = (x: number, y: number, d: Drag, cursorStyle = 'move', filled = true) => (
    <circle key={`${d.type}`} cx={x} cy={y} r={HANDLE} fill={filled ? '#1b1b1b' : 'transparent'} stroke="#fff" strokeWidth={1.6} style={{ cursor: cursorStyle, pointerEvents: 'all' }} onPointerDown={start(d)} />
  )

  const linearHandles = (m: Mask, c: Extract<MaskComponent, { kind: 'linear' }>) => {
    const p0 = fromN(c.x0, c.y0)
    const p1 = fromN(c.x1, c.y1)
    const dx = p1[0] - p0[0]
    const dy = p1[1] - p0[1]
    const len = Math.hypot(dx, dy) || 1
    const nxv = -dy / len
    const nyv = dx / len
    const ext = Math.max(vw, vh)
    const line = (p: [number, number], dash?: string) => <line x1={p[0] - nxv * ext} y1={p[1] - nyv * ext} x2={p[0] + nxv * ext} y2={p[1] + nyv * ext} stroke="#fff" strokeOpacity={0.85} strokeWidth={1} strokeDasharray={dash} pointerEvents="none" />
    const mid: [number, number] = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2]
    return (
      <g>
        {line(p0)}
        {line(p1)}
        {line(mid, '4 4')}
        {handle(p0[0], p0[1], { type: 'lin0', maskId: m.id, compId: c.id }, 'grab')}
        {handle(p1[0], p1[1], { type: 'lin1', maskId: m.id, compId: c.id }, 'grab')}
        {handle(mid[0], mid[1], { type: 'linMove', maskId: m.id, compId: c.id, start: toN(mid[0], mid[1]), orig: [c.x0, c.y0, c.x1, c.y1] }, 'move', false)}
      </g>
    )
  }

  const radialHandles = (m: Mask, c: Extract<MaskComponent, { kind: 'radial' }>) => {
    const ellipse = (scale: number) =>
      Array.from({ length: 73 }, (_, k) => {
        const a = (k / 72) * Math.PI * 2
        const [ex, ey] = rot(Math.cos(a) * c.rx * L * scale, Math.sin(a) * c.ry * L * scale, c.angle)
        const [x, y] = fromPx(c.cx * W + ex, c.cy * H + ey)
        return `${k ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
      }).join(' ')
    const at = (lx: number, ly: number) => {
      const [ex, ey] = rot(lx, ly, c.angle)
      return fromPx(c.cx * W + ex, c.cy * H + ey)
    }
    const ctr = fromN(c.cx, c.cy)
    const xp = at(c.rx * L, 0)
    const xm = at(-c.rx * L, 0)
    const yp = at(0, c.ry * L)
    const ym = at(0, -c.ry * L)
    const rp = at(c.rx * L * 1.3, 0)
    const inner = Math.max(0.05, 1 - c.feather / 100)
    return (
      <g>
        <path d={ellipse(1)} fill="none" stroke="#fff" strokeOpacity={0.9} strokeWidth={1.2} pointerEvents="none" />
        <path d={ellipse(inner)} fill="none" stroke="#fff" strokeOpacity={0.55} strokeWidth={1} strokeDasharray="4 4" pointerEvents="none" />
        <line x1={xp[0]} y1={xp[1]} x2={rp[0]} y2={rp[1]} stroke="#fff" strokeOpacity={0.6} pointerEvents="none" />
        {handle(ctr[0], ctr[1], { type: 'radMove', maskId: m.id, compId: c.id, start: toN(ctr[0], ctr[1]), orig: [c.cx, c.cy] }, 'move', false)}
        <g key="rx1">{handle(xp[0], xp[1], { type: 'radX', maskId: m.id, compId: c.id }, 'ew-resize')}</g>
        <g key="rx2">{handle(xm[0], xm[1], { type: 'radX', maskId: m.id, compId: c.id }, 'ew-resize')}</g>
        <g key="ry1">{handle(yp[0], yp[1], { type: 'radY', maskId: m.id, compId: c.id }, 'ns-resize')}</g>
        <g key="ry2">{handle(ym[0], ym[1], { type: 'radY', maskId: m.id, compId: c.id }, 'ns-resize')}</g>
        <g key="rot">{handle(rp[0], rp[1], { type: 'radRot', maskId: m.id, compId: c.id }, 'crosshair', false)}</g>
      </g>
    )
  }

  const circle = (x: number, y: number, r: number, selected: boolean, dashed = false) => (
    <circle cx={x} cy={y} r={Math.max(3, r)} fill="none" stroke={selected ? ACCENT : '#fff'} strokeWidth={selected ? 2 : 1.3} strokeDasharray={dashed ? '5 4' : undefined} pointerEvents="none" />
  )

  const spotShapes = (s: Spot) => {
    const d = fromN(s.x, s.y)
    const src = fromN(s.sx, s.sy)
    const r = s.radius * L * pxPerSrc
    const sel = s.id === spotSel
    return (
      <g key={s.id}>
        <line x1={d[0]} y1={d[1]} x2={src[0]} y2={src[1]} stroke={sel ? ACCENT : '#fff'} strokeOpacity={0.7} strokeDasharray="3 3" pointerEvents="none" />
        {circle(src[0], src[1], r, sel, true)}
        {circle(d[0], d[1], r, sel)}
        <circle
          cx={d[0]}
          cy={d[1]}
          r={Math.max(6, r)}
          fill="transparent"
          style={{ cursor: 'move', pointerEvents: 'all' }}
          onPointerDown={(e) => {
            useDevelop.getState().setSpotSel(s.id)
            start({ type: 'spotDest', id: s.id, start: toN(...local(e)), orig: [s.x, s.y] })(e)
          }}
        />
        <circle
          cx={src[0]}
          cy={src[1]}
          r={Math.max(6, r)}
          fill="transparent"
          style={{ cursor: 'move', pointerEvents: 'all' }}
          onPointerDown={(e) => {
            useDevelop.getState().setSpotSel(s.id)
            start({ type: 'spotSrc', id: s.id, start: toN(...local(e)), orig: [s.sx, s.sy] })(e)
          }}
        />
        {sel && handle(d[0] + r, d[1], { type: 'spotRadius', id: s.id }, 'ew-resize')}
      </g>
    )
  }

  const eyeShapes = (r: RedEye) => {
    const c = fromN(r.x, r.y)
    const rad = r.radius * L * pxPerSrc
    const sel = r.id === redSel
    return (
      <g key={r.id}>
        {circle(c[0], c[1], rad, sel)}
        <circle
          cx={c[0]}
          cy={c[1]}
          r={Math.max(6, rad)}
          fill="transparent"
          style={{ cursor: 'move', pointerEvents: 'all' }}
          onPointerDown={(e) => {
            useDevelop.getState().setRedSel(r.id)
            start({ type: 'eyeMove', id: r.id, start: toN(...local(e)), orig: [r.x, r.y] })(e)
          }}
        />
        {sel && handle(c[0] + rad, c[1], { type: 'eyeRadius', id: r.id }, 'ew-resize')}
      </g>
    )
  }

  const selMask = masks.find((m) => m.id === maskSel)
  const selComp = selMask?.components.find((c) => c.id === compSel) ?? selMask?.components[0]
  const capture = tool === 'spot' || tool === 'redeye' || (tool === 'mask' && !!draw)
  const brushR = brush.size * L * pxPerSrc * 0.5

  return (
    <svg ref={svg} className="absolute inset-0 z-[5] size-full" style={{ pointerEvents: 'none' }} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={() => setCursor(null)}>
      {capture && <rect width={vw} height={vh} fill="transparent" style={{ pointerEvents: 'all', cursor: draw?.kind === 'brush' ? 'none' : 'crosshair' }} onPointerDown={onBackgroundDown} />}

      {tool === 'mask' && (
        <>
          {!draw && selComp?.kind === 'linear' && selMask && linearHandles(selMask, selComp)}
          {!draw && selComp?.kind === 'radial' && selMask && radialHandles(selMask, selComp)}
          {masks
            .filter((m) => m.visible)
            .map((m, i) => {
              const a = maskAnchor(m)
              const [x, y] = fromN(a.x, a.y)
              const sel = m.id === maskSel
              return (
                <g key={m.id} style={{ cursor: 'pointer', pointerEvents: 'all' }} onPointerDown={(e) => {
                  e.stopPropagation()
                  useDevelop.getState().setMaskDraw(null)
                  useDevelop.getState().selectMask(m.id, m.components[0]?.id ?? null)
                }}>
                  <circle cx={x} cy={y} r={9} fill={sel ? ACCENT : '#1b1b1b'} stroke="#fff" strokeWidth={1.5} />
                  <text x={x} y={y + 3.5} textAnchor="middle" fontSize={10} fontWeight={600} fill={sel ? '#1b1305' : '#fff'} pointerEvents="none">
                    {i + 1}
                  </text>
                </g>
              )
            })}
          {draw?.kind === 'brush' && cursor && (
            <g pointerEvents="none">
              <circle cx={cursor[0]} cy={cursor[1]} r={Math.max(2, brushR)} fill="none" stroke="#fff" strokeWidth={1.3} />
              <circle cx={cursor[0]} cy={cursor[1]} r={Math.max(1, brushR * (1 - brush.feather / 100))} fill="none" stroke="#fff" strokeOpacity={0.55} strokeDasharray="3 3" />
              {brush.erase && <text x={cursor[0]} y={cursor[1] - brushR - 6} textAnchor="middle" fontSize={11} fill="#fff">−</text>}
            </g>
          )}
        </>
      )}
      {tool === 'spot' && spots.map(spotShapes)}
      {tool === 'redeye' && eyes.map(eyeShapes)}
    </svg>
  )
}
