/**
 * Maps an EXIF camera name to a brand key so the frame can show a small logo next to it.
 *
 * The logo images themselves are never part of this repository (see `.gitignore`: `public/logos/`) —
 * camera brand marks are third-party trademarks and this project is a public repo. If you want logos in
 * your own local build, drop `<key>.png` files (transparent background, roughly square) into
 * `public/logos/`; they are picked up automatically and simply don't exist in the public deployment.
 */

export const BRAND_KEYS = [
  'canon', 'nikon', 'sony', 'fujifilm', 'panasonic', 'olympus', 'pentax', 'ricoh',
  'leica', 'hasselblad', 'sigma', 'kodak', 'casio', 'phaseone', 'apple', 'samsung',
  'google', 'huawei', 'xiaomi', 'oneplus', 'gopro', 'dji', 'insta360',
] as const
export type BrandKey = (typeof BRAND_KEYS)[number]

/** Substrings to look for in the EXIF `Make`/camera name, checked case-insensitively, longest match first. */
const PATTERNS: Record<BrandKey, string[]> = {
  canon: ['canon'],
  nikon: ['nikon'],
  sony: ['sony'],
  fujifilm: ['fujifilm', 'fuji photo', 'fuji '],
  panasonic: ['panasonic', 'lumix'],
  olympus: ['olympus', 'om digital', 'om system'],
  pentax: ['pentax', 'ricoh imaging'],
  ricoh: ['ricoh'],
  leica: ['leica'],
  hasselblad: ['hasselblad'],
  sigma: ['sigma'],
  kodak: ['kodak'],
  casio: ['casio'],
  phaseone: ['phase one'],
  apple: ['apple', 'iphone'],
  samsung: ['samsung'],
  google: ['google', 'pixel'],
  huawei: ['huawei'],
  xiaomi: ['xiaomi', 'redmi'],
  oneplus: ['oneplus'],
  gopro: ['gopro'],
  dji: ['dji'],
  insta360: ['insta360'],
}

/** `ricoh` overlaps with `pentax` (Ricoh Imaging); prefer Pentax for camera bodies branded that way. */
const ORDER: BrandKey[] = ['phaseone', 'pentax', 'ricoh', 'hasselblad', 'fujifilm', 'panasonic', 'olympus', 'oneplus', 'insta360', 'gopro', 'dji', 'huawei', 'xiaomi', 'samsung', 'google', 'apple', 'sigma', 'kodak', 'casio', 'leica', 'canon', 'nikon', 'sony']

/** Find a known brand in a camera name string (e.g. the joined "Make Model" EXIF text). Null if none match. */
export function resolveBrandKey(cameraText: string | undefined | null): BrandKey | null {
  const s = (cameraText ?? '').toLowerCase()
  if (!s.trim()) return null
  for (const key of ORDER) {
    if (PATTERNS[key].some((p) => s.includes(p))) return key
  }
  return null
}

/** Published path of a brand's logo file, relative to the app root (may 404 — that's expected/fine). */
export function logoPath(key: BrandKey): string {
  return `logos/${key}.png`
}
