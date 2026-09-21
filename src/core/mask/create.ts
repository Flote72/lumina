import { DEFAULT_MASK_ADJUST, type BrushStroke, type Mask, type MaskComponent, type MaskKind, type MaskOp } from '../params/params'

const uid = () => crypto.randomUUID()

export interface BrushSettings {
  /** fraction of the long side */
  size: number
  feather: number
  flow: number
  density: number
}
export const DEFAULT_BRUSH: BrushSettings = { size: 0.06, feather: 60, flow: 60, density: 100 }

export function newStroke(b: BrushSettings, erase: boolean, x: number, y: number): BrushStroke {
  return { erase, size: b.size, feather: b.feather, flow: b.flow, density: b.density, points: [x, y] }
}

/** A fresh component of the given kind, centred on (cx, cy) (normalized). */
export function newComponent(kind: MaskKind, op: MaskOp = 'add', cx = 0.5, cy = 0.5): MaskComponent {
  const base = { id: uid(), op, invert: false }
  switch (kind) {
    case 'brush':
      return { ...base, kind, strokes: [] }
    case 'linear':
      return { ...base, kind, x0: cx, y0: Math.max(0, cy - 0.15), x1: cx, y1: Math.min(1, cy + 0.15) }
    case 'radial':
      return { ...base, kind, cx, cy, rx: 0.2, ry: 0.2, angle: 0, feather: 50 }
    case 'luminance':
      return { ...base, kind, lo: 0.6, hi: 1, smooth: 0.1 }
    case 'color':
      return { ...base, kind, r: 0.5, g: 0.5, b: 0.5, range: 40 }
  }
}

export function newMask(name: string, first: MaskComponent): Mask {
  return { id: uid(), name, visible: true, invert: false, amount: 100, components: [first], adjust: { ...DEFAULT_MASK_ADJUST } }
}

/** Sensible anchor for a mask's pin in normalized image coordinates. */
export function maskAnchor(m: Mask): { x: number; y: number } {
  for (const c of m.components) {
    switch (c.kind) {
      case 'radial':
        return { x: c.cx, y: c.cy }
      case 'linear':
        return { x: (c.x0 + c.x1) / 2, y: (c.y0 + c.y1) / 2 }
      case 'brush': {
        const p = c.strokes[0]?.points
        if (p && p.length >= 2) return { x: p[0]!, y: p[1]! }
      }
    }
  }
  return { x: 0.5, y: 0.5 }
}

/** Cheap change-detection key for the parts of a mask that affect its shape (not its adjustments). */
export function maskShapeKey(m: Mask): string {
  const parts = m.components.map((c) => {
    if (c.kind === 'brush') {
      const last = c.strokes[c.strokes.length - 1]
      return `${c.id}:b:${c.op}:${c.invert ? 1 : 0}:${c.strokes.length}:${last?.points.length ?? 0}:${last ? last.points[last.points.length - 1] : ''}`
    }
    const { id, ...rest } = c
    return `${id}:${JSON.stringify(rest)}`
  })
  return `${m.id}|${m.invert ? 1 : 0}|${m.amount}|${parts.join(';')}`
}
