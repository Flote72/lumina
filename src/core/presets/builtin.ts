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
  night: { ko: '야간', en: 'Night' },
  street: { ko: '스트리트', en: 'Street' },
  travel: { ko: '여행', en: 'Travel' },
  season: { ko: '계절', en: 'Seasonal' },
  food: { ko: '푸드', en: 'Food' },
  product: { ko: '제품', en: 'Product' },
  wedding: { ko: '웨딩', en: 'Wedding' },
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
  P('util-flat', 'util', '플랫 프로파일', 'Flat Profile', { basic: { contrast: -20, saturation: -15, highlights: -10, shadows: 10 } }),
  // Night
  P('night-neon', 'night', '네온 나이트', 'Neon Night', {
    basic: { contrast: 25, shadows: 15, blacks: -10, clarity: 15, vibrance: 20 },
    grading: { shadows: { h: 260, s: 35, l: 0 }, highlights: { h: 300, s: 25, l: 0 }, blending: 55 },
    mixer: { hue: { blue: -5 }, sat: { blue: 20, purple: 25, magenta: 20 } },
    effects: { grainAmount: 15 },
  }),
  P('night-bluehour', 'night', '블루 아워', 'Blue Hour', {
    basic: { temp: -18, tint: 2, exposure: 0.2, shadows: 25, contrast: 10, highlights: -10 },
    grading: { shadows: { h: 225, s: 30, l: 0 }, midtones: { h: 220, s: 12, l: 0 } },
    effects: { vigAmount: -20 },
  }),
  P('night-warmglow', 'night', '야간 불빛', 'Warm Night Glow', {
    basic: { temp: 8, contrast: 20, highlights: -10, shadows: 10 },
    grading: { highlights: { h: 40, s: 35, l: 0 }, shadows: { h: 220, s: 25, l: 0 }, blending: 50 },
    effects: { vigAmount: -25, grainAmount: 18 },
  }),
  P('night-portrait', 'night', '야간 인물', 'Night Portrait', {
    basic: { exposure: 0.3, shadows: 30, blacks: -5, clarity: -5 },
    mixer: { lum: { orange: 10 }, sat: { orange: -5 } },
    detail: { nrLum: 20, nrColor: 15 },
  }),
  P('night-street', 'night', '야간 스트리트', 'Night Street', {
    basic: { contrast: 35, blacks: -25, clarity: 20, highlights: -15 },
    grading: { shadows: { h: 200, s: 30, l: 0 } },
    effects: { vigAmount: -35, grainAmount: 35, grainSize: 30 },
  }),
  // Street
  P('street-urban', 'street', '어반 그릿', 'Urban Grit', { basic: { contrast: 30, clarity: 25, texture: 15, saturation: -20, dehaze: 10 }, effects: { grainAmount: 25 } }),
  P('street-rain', 'street', '레이니 스트리트', 'Rainy Street', {
    basic: { temp: -8, tint: 3, contrast: -5, highlights: -20, saturation: -10, clarity: 10 },
    grading: { shadows: { h: 210, s: 20, l: 0 } },
  }),
  P('street-concrete', 'street', '콘크리트 정글', 'Concrete Jungle', {
    basic: { contrast: 15, saturation: -25, clarity: 25, dehaze: 12, blacks: -10 },
    grading: { shadows: { h: 200, s: 15, l: 0 }, highlights: { h: 200, s: 8, l: 0 } },
  }),
  // Travel
  P('travel-tropical', 'travel', '트로피컬 비비드', 'Tropical Vivid', {
    basic: { exposure: 0.2, contrast: 15, vibrance: 35, saturation: 12, dehaze: 10 },
    mixer: { sat: { green: 15, aqua: 20, blue: 10 } },
  }),
  P('travel-beach', 'travel', '비치 브라이트', 'Beach Bright', { basic: { exposure: 0.4, temp: 8, highlights: -10, whites: 15, shadows: 15, saturation: -5 } }),
  P('travel-sunset', 'travel', '선셋 비치', 'Sunset Beach', {
    basic: { temp: 20, exposure: 0.15, highlights: -15, vibrance: 25 },
    grading: { highlights: { h: 30, s: 45, l: 0 }, shadows: { h: 320, s: 15, l: 0 } },
  }),
  P('travel-pastelpool', 'travel', '풀사이드 파스텔', 'Poolside Pastel', {
    basic: { exposure: 0.3, contrast: -12, shadows: 20, saturation: -10 },
    grading: { shadows: { h: 190, s: 15, l: 0 }, highlights: { h: 340, s: 10, l: 0 } },
  }),
  // Seasonal
  P('season-autumn', 'season', '가을 감성', 'Autumn Warmth', {
    basic: { temp: 15, contrast: 12, vibrance: 15 },
    mixer: { hue: { yellow: -10, orange: 5 }, sat: { orange: 15, yellow: 15 }, lum: { orange: -5 } },
  }),
  P('season-spring', 'season', '봄 파스텔', 'Spring Pastel', { basic: { exposure: 0.2, contrast: -8, shadows: 15, vibrance: 10 }, mixer: { sat: { green: 10, magenta: 8 } } }),
  P('season-winter', 'season', '윈터 프로스트', 'Winter Frost', {
    basic: { temp: -15, contrast: 10, whites: 15, saturation: -15, clarity: 10 },
    grading: { shadows: { h: 210, s: 15, l: 0 } },
  }),
  // Food
  P('food-warm', 'food', '푸드 웜', 'Food Warm', {
    basic: { temp: 10, exposure: 0.15, contrast: 15, texture: 15, clarity: 10, vibrance: 15 },
    mixer: { sat: { red: 10, orange: 12 } },
  }),
  P('food-clean', 'food', '푸드 클린', 'Food Clean Bright', { basic: { exposure: 0.3, contrast: 8, whites: 10, texture: 10, clarity: 8 } }),
  // Product
  P('product-white', 'product', '클린 화이트', 'Clean White', { basic: { exposure: 0.35, contrast: 5, whites: 20, blacks: 5, clarity: 8, saturation: -5 } }),
  P('product-minimal', 'product', '미니멀 소프트', 'Minimal Soft', { basic: { contrast: -10, shadows: 15, clarity: -5, saturation: -8 } }),
  // Wedding
  P('wed-pastel', 'wedding', '파스텔 웨딩', 'Pastel Wedding', { basic: { exposure: 0.3, contrast: -12, highlights: -10, shadows: 20, vibrance: 10 }, mixer: { lum: { orange: 8 } } }),
  P('wed-romance', 'wedding', '소프트 로맨스', 'Soft Romance', {
    basic: { temp: 6, exposure: 0.2, contrast: -8, highlights: -15, clarity: -10 },
    grading: { highlights: { h: 35, s: 15, l: 0 } },
  }),
  // Creative (additions)
  P('cr-darkacademia', 'creative', '다크 아카데미아', 'Dark Academia', {
    basic: { contrast: 25, shadows: -10, blacks: -15, saturation: -15, temp: 6 },
    grading: { shadows: { h: 30, s: 20, l: 0 }, midtones: { h: 40, s: 10, l: 0 } },
  }),
  P('cr-dreamyhaze', 'creative', '드리미 헤이즈', 'Dreamy Haze', { basic: { contrast: -15, blacks: 20, highlights: -10, clarity: -20, dehaze: -15 }, effects: { vigAmount: -10 } }),
  P('cr-retrovhs', 'creative', '레트로 VHS', 'Retro VHS', {
    basic: { contrast: 10, saturation: 10 },
    toneCurve: { points: { r: pt(0, 10, 128, 140, 255, 250), b: pt(0, 0, 128, 118, 255, 245) } },
    effects: { grainAmount: 40, grainSize: 40, grainRough: 70 },
  }),
]
