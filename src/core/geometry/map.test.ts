import { describe, expect, it } from 'vitest'
import { createDefaultParams } from '../params/params'
import { sourceToViewport, viewportToSource, type MapParams } from './map'

const base = (o: Partial<MapParams> = {}): MapParams => ({
  W: 6000,
  H: 4000,
  cx: 3000,
  cy: 2000,
  angle: 0,
  zoom: 0.2,
  panX: 0,
  panY: 0,
  vw: 1200,
  vh: 800,
  transform: createDefaultParams().transform,
  distortion: 0,
  ...o,
})

describe('viewport ⇄ source mapping', () => {
  it('centre of the viewport is the crop centre', () => {
    const [x, y] = viewportToSource(600, 400, base())
    expect(x).toBeCloseTo(3000, 6)
    expect(y).toBeCloseTo(2000, 6)
  })
  it('scales by zoom and follows pan', () => {
    const [x] = viewportToSource(700, 400, base())
    expect(x).toBeCloseTo(3000 + 100 / 0.2, 6)
    const [x2] = viewportToSource(600, 400, base({ panX: 50 }))
    expect(x2).toBeCloseTo(3000 - 50 / 0.2, 6)
  })
  it('positive angle rotates the image clockwise on screen', () => {
    // a point to the right of centre in the viewport samples up-right of centre in the source
    const [, y] = viewportToSource(700, 400, base({ angle: (10 * Math.PI) / 180 }))
    expect(y).toBeLessThan(2000)
  })
  it('round-trips through the inverse for every kind of distortion', () => {
    const t = createDefaultParams().transform
    const cases: Partial<MapParams>[] = [
      {},
      { angle: 0.3, panX: 40, panY: -25, zoom: 0.5 },
      { transform: { ...t, vertical: 40, horizontal: -25, scale: 90, aspect: 30, xOffset: 10, yOffset: -8 } },
      { distortion: 60, angle: -0.1 },
      { transform: { ...t, vertical: -60 }, distortion: -40, zoom: 1.5 },
    ]
    for (const c of cases) {
      const m = base(c)
      for (const [vx, vy] of [[100, 100], [600, 400], [1100, 700], [300, 650]] as const) {
        const [px, py] = viewportToSource(vx, vy, m)
        const [rx, ry] = sourceToViewport(px, py, m)
        expect(rx).toBeCloseTo(vx, 2)
        expect(ry).toBeCloseTo(vy, 2)
      }
    }
  })
})
