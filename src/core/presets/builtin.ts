import type { CurvePoint, DeepPartial, EditParams } from '../params/params'

export interface BuiltinPreset {
  id: string
  group: { ko: string; en: string }
  name: { ko: string; en: string }
  patch: DeepPartial<EditParams>
}

const pt = (...v: number[]): CurvePoint[] => v.reduce<CurvePoint[]>((a, _, i) => (i % 2 ? a : [...a, { x: v[i]! / 255, y: v[i + 1]! / 255 }]), [])
const G = {
  bw: { ko: '흑백', en: 'Black & White' },
  film: { ko: '필름', en: 'Film' },
  cine: { ko: '시네마틱', en: 'Cinematic' },
  portrait: { ko: '인물', en: 'Portrait' },
  land: { ko: '풍경', en: 'Landscape' },
  creative: { ko: '크리에이티브', en: 'Creative' },
  util: { ko: '유틸리티', en: 'Utility' },
}
const P = (id: string, group: keyof typeof G, ko: string, en: string, patch: DeepPartial<EditParams>): BuiltinPreset => ({
  id: `builtin.${id}`,
  group: G[group],
  name: { ko, en },
  patch,
})
const bw = (mix: Partial<Record<'red' | 'orange' | 'yellow' | 'green' | 'aqua' | 'blue' | 'purple' | 'magenta', number>> = {}) => ({ enabled: true, mix })

export const BUILTIN_PRESETS: BuiltinPreset[] = [
  // Black & white
  P('bw-classic', 'bw', '흑백 클래식', 'B&W Classic', { bw: bw(), basic: { contrast: 20 } }),
  P('bw-contrast', 'bw', '흑백 하이 콘트라스트', 'B&W High Contrast', { bw: bw(), basic: { contrast: 55, blacks: -25, whites: 20, clarity: 20 } }),
  P('bw-soft', 'bw', '흑백 소프트', 'B&W Soft', { bw: bw(), basic: { contrast: -15, shadows: 25, highlights: -15, clarity: -10 } }),
  P('bw-red', 'bw', '흑백 레드 필터', 'B&W Red Filter', { bw: bw({ red: 60, orange: 40, yellow: 20, blue: -60, aqua: -40 }), basic: { contrast: 25 } }),
  P('bw-grain', 'bw', '흑백 필름 그레인', 'B&W Film Grain', { bw: bw(), basic: { contrast: 25, blacks: -10 }, effects: { grainAmount: 45, grainSize: 30, grainRough: 60 } }),
  // Film
  P('film-warm', 'film', '따뜻한 필름', 'Warm Film', {
    basic: { temp: 12, contrast: 10, highlights: -15, blacks: 8, vibrance: 10 },
    toneCurve: { points: { rgb: pt(0, 14, 64, 60, 190, 196, 255, 244) } },
    effects: { grainAmount: 20, grainSize: 25 },
  }),
  P('film-cool', 'film', '차가운 필름', 'Cool Film', {
    basic: { temp: -14, tint: 4, contrast: 8, highlights: -10, blacks: 6 },
    toneCurve: { points: { rgb: pt(0, 12, 64, 62, 192, 196, 255, 246) } },
    effects: { grainAmount: 18, grainSize: 25 },
  }),
  P('film-faded', 'film', '페이드 필름', 'Faded Film', {
    basic: { contrast: -10, saturation: -12, blacks: 30 },
    toneCurve: { points: { rgb: pt(0, 32, 128, 128, 255, 236) } },
    effects: { grainAmount: 22 },
  }),
  P('film-70s', 'film', '빈티지 70s', 'Vintage 70s', {
    basic: { temp: 18, tint: 8, contrast: 5, saturation: -8, highlights: -20, blacks: 15 },
    grading: { shadows: { h: 30, s: 25 }, highlights: { h: 50, s: 30 } },
    effects: { vigAmount: -25, grainAmount: 30, grainSize: 35 },
  }),
  P('film-cross', 'film', '크로스 프로세스', 'Cross Process', {
    basic: { contrast: 25, saturation: 15 },
    toneCurve: { points: { r: pt(0, 0, 90, 70, 255, 255), b: pt(0, 24, 128, 140, 255, 220), g: pt(0, 0, 128, 132, 255, 255) } },
  }),
  // Cinematic
  P('cine-teal-orange', 'cine', '틸 & 오렌지', 'Teal & Orange', {
    basic: { contrast: 15, vibrance: 15 },
    grading: { shadows: { h: 200, s: 45 }, highlights: { h: 35, s: 50 }, blending: 60 },
    mixer: { hue: { orange: 5, aqua: -10 }, sat: { blue: -20 } },
  }),
  P('cine-moody', 'cine', '무디 블루', 'Moody Blue', {
    basic: { exposure: -0.3, contrast: 20, highlights: -25, shadows: 10, saturation: -15 },
    grading: { shadows: { h: 215, s: 40 }, midtones: { h: 210, s: 15 } },
    effects: { vigAmount: -30 },
  }),
  P('cine-golden', 'cine', '골든 아워', 'Golden Hour', {
    basic: { temp: 22, exposure: 0.1, highlights: -20, vibrance: 20 },
    grading: { highlights: { h: 40, s: 40 }, shadows: { h: 20, s: 20 } },
    effects: { vigAmount: -15 },
  }),
  P('cine-bleach', 'cine', '블리치 바이패스', 'Bleach Bypass', {
    basic: { contrast: 40, saturation: -40, clarity: 25, highlights: -15 },
    effects: { grainAmount: 20 },
  }),
  P('cine-noir', 'cine', '누아르', 'Noir', { bw: bw({ red: 30, yellow: 15, blue: -40 }), basic: { contrast: 60, blacks: -40, exposure: -0.2, clarity: 15 }, effects: { vigAmount: -45, grainAmount: 25 } }),
  // Portrait
  P('portrait-soft', 'portrait', '소프트 인물', 'Soft Portrait', { basic: { contrast: -10, clarity: -15, texture: -20, highlights: -10, vibrance: 8 }, mixer: { sat: { orange: -8 }, lum: { orange: 10 } } }),
  P('portrait-bright', 'portrait', '밝은 피부', 'Bright Skin', { basic: { exposure: 0.35, shadows: 20, whites: 10, texture: -15 }, mixer: { lum: { orange: 15, red: 8 }, sat: { orange: -5 } } }),
  // Landscape
  P('land-vivid', 'land', '선명한 풍경', 'Vivid Landscape', { basic: { contrast: 20, clarity: 20, dehaze: 15, vibrance: 30, saturation: 8 }, mixer: { sat: { green: 10, blue: 12 } } }),
  P('land-matte', 'land', '매트 풍경', 'Matte Landscape', { basic: { contrast: -8, blacks: 25, saturation: -10, dehaze: 8 }, toneCurve: { points: { rgb: pt(0, 26, 128, 128, 255, 244) } } }),
  // Creative
  P('cr-sepia', 'creative', '세피아', 'Sepia', { bw: bw(), basic: { contrast: 12 }, grading: { global: { h: 38, s: 35 }, shadows: { h: 30, s: 20 } } }),
  P('cr-highkey', 'creative', '하이키', 'High Key', { basic: { exposure: 0.7, shadows: 40, whites: 30, contrast: -10, saturation: -8 } }),
  P('cr-lowkey', 'creative', '로우키', 'Low Key', { basic: { exposure: -0.7, highlights: -20, blacks: -30, contrast: 25 }, effects: { vigAmount: -35 } }),
  P('cr-punchy', 'creative', '펀치', 'Punchy', { basic: { contrast: 30, clarity: 15, vibrance: 35, saturation: 10, blacks: -10 } }),
  // Utility
  P('util-clarity', 'util', '명료도 강화', 'Clarity Boost', { basic: { clarity: 30, texture: 20, dehaze: 10 } }),
  P('util-sharpen', 'util', '웹용 샤프닝', 'Sharpen for Web', { detail: { sharpAmount: 60, sharpRadius: 1, sharpDetail: 30, sharpMasking: 20 } }),
]
