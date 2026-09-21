import { describe, expect, it } from 'vitest'
import { applyPatch, createDefaultParams } from './params'
import { DEFAULT_COPY_GROUPS, extractPatch, patchGroups } from './groups'

describe('setting groups', () => {
  const p = createDefaultParams()
  p.basic.temp = 12
  p.basic.exposure = 1
  p.basic.clarity = 30
  p.crop.angle = 5
  p.effects.vigAmount = -20

  it('extracts only the selected groups', () => {
    const patch = extractPatch(p, ['wb', 'effects'])
    expect(patch.basic).toEqual({ temp: 12, tint: 0 })
    expect(patch.effects?.vigAmount).toBe(-20)
    expect(patch.crop).toBeUndefined()
    expect(patch.toneCurve).toBeUndefined()
  })
  it('default copy set excludes crop', () => {
    expect(extractPatch(p, DEFAULT_COPY_GROUPS).crop).toBeUndefined()
  })
  it('paste = applyPatch leaves unselected settings alone', () => {
    const target = createDefaultParams()
    target.basic.exposure = -2
    const out = applyPatch(target, extractPatch(p, ['wb']))
    expect(out.basic.temp).toBe(12)
    expect(out.basic.exposure).toBe(-2)
  })
  it('does not alias source objects', () => {
    const patch = extractPatch(p, ['curve'])
    patch.toneCurve!.points!.rgb![0]!.y = 0.9
    expect(p.toneCurve.points.rgb[0]!.y).toBe(0)
  })
  it('reports which groups a patch touches', () => {
    expect(patchGroups({ basic: { temp: 1 }, effects: { grainAmount: 3 } })).toEqual(['wb', 'effects'])
  })
})
