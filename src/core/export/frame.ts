/**
 * "EXIF frame": an information bar rendered next to the photo showing camera / lens / exposure / date,
 * inspired by the popular "shot on" frame trend. Pure layout logic lives here so it is unit-testable;
 * `export/exporter.ts` does the actual canvas drawing.
 */

export type FrameStyle = 'minimal' | 'strap' | 'film'
export type FramePosition = 'bottom' | 'top'
export type FrameBackground = 'light' | 'dark'

export interface FrameSettings {
  enabled: boolean
  style: FrameStyle
  position: FramePosition
  background: FrameBackground
  showCamera: boolean
  showLens: boolean
  showExposure: boolean
  showFocalLength: boolean
  showDate: boolean
  /** free text appended to the secondary line (e.g. a name or location) */
  customText: string
  /** show a brand logo next to the camera name, IF one has been uploaded (see store/exportSettings.ts) */
  showLogo: boolean
  /** manual lens name; overrides the EXIF lens string when non-empty (EXIF lens names are often empty or messy) */
  lensOverride: string
}

export const DEFAULT_FRAME: FrameSettings = {
  enabled: false,
  style: 'strap',
  position: 'bottom',
  background: 'light',
  showCamera: true,
  showLens: true,
  showExposure: true,
  showFocalLength: true,
  showDate: true,
  customText: '',
  showLogo: true,
  lensOverride: '',
}

export interface FrameExifInput {
  make?: string
  model?: string
  lens?: string
  focalLength?: number | null
  fNumber?: number | null
  exposureTime?: number | null
  iso?: number | null
  capturedAt?: number | null
}

const clean = (s: string | undefined) => (s ?? '').trim()

/** "Canon Canon EOS R5" → "Canon EOS R5" (model already repeats the maker). */
export function joinMakeModel(make: string | undefined, model: string | undefined): string {
  const mk = clean(make)
  const md = clean(model)
  if (!md) return mk
  if (!mk) return md
  return md.toLowerCase().startsWith(mk.split(' ')[0]!.toLowerCase()) ? md : `${mk} ${md}`
}

export function formatShutter(s: number | null | undefined): string {
  if (!s || s <= 0) return ''
  return s >= 1 ? `${s % 1 === 0 ? s : s.toFixed(1)}s` : `1/${Math.round(1 / s)}s`
}
/** "f/8" — used in the generic (minimal/film) secondary line. */
export function formatAperture(f: number | null | undefined): string {
  return f && f > 0 ? `f/${f % 1 === 0 ? f : f.toFixed(1)}` : ''
}
/** "F8" — the bare, capital-F form used on the Strap style's exposure line. */
export function formatFStop(f: number | null | undefined): string {
  return f && f > 0 ? `F${f % 1 === 0 ? f : f.toFixed(1)}` : ''
}
export function formatFocalLength(mm: number | null | undefined): string {
  return mm && mm > 0 ? `${Math.round(mm)}mm` : ''
}
export function formatIso(iso: number | null | undefined): string {
  return iso && iso > 0 ? `ISO${Math.round(iso)}` : ''
}
export function formatDate(ts: number | null | undefined): string {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
}
/** "2026/07/19 13:47:44" — full date + time, used on the Strap style's left column. */
export function formatDateTime(ts: number | null | undefined): string {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export interface FrameLines {
  /** camera + lens (the bold/larger line in 'strap' and 'film') */
  primary: string
  /** exposure + date + custom text */
  secondary: string
}

/** Manual override, if set, else the EXIF value — used for the lens name everywhere in the frame. */
function lensText(exif: FrameExifInput, s: FrameSettings): string {
  return clean(s.lensOverride) || clean(exif.lens)
}

/** Build the two text lines from EXIF + the chosen toggles. Missing fields are simply omitted. */
export function buildFrameLines(exif: FrameExifInput, s: FrameSettings): FrameLines {
  const primaryParts: string[] = []
  if (s.showCamera) primaryParts.push(joinMakeModel(exif.make, exif.model))
  if (s.showLens) primaryParts.push(lensText(exif, s))

  const secondaryParts: string[] = []
  if (s.showFocalLength) secondaryParts.push(formatFocalLength(exif.focalLength))
  if (s.showExposure) secondaryParts.push(formatAperture(exif.fNumber), formatShutter(exif.exposureTime), formatIso(exif.iso))
  if (s.showDate) secondaryParts.push(formatDate(exif.capturedAt))
  if (clean(s.customText)) secondaryParts.push(clean(s.customText))

  return {
    primary: primaryParts.filter(Boolean).join('  '),
    secondary: secondaryParts.filter(Boolean).join('   ·   '),
  }
}

/** Whether the frame would render anything at all (both lines empty ⇒ skip it, even if enabled). */
export function frameHasContent(lines: FrameLines): boolean {
  return lines.primary.length > 0 || lines.secondary.length > 0
}

/**
 * The Strap style's fixed, four-part composition (see the reference layout): a left column with the
 * exposure settings and full timestamp, and a right column with the logo, camera and lens name.
 */
export interface StrapParts {
  /** "ISO320 F8 1/800s" */
  exposure: string
  /** "2026/07/19 13:47:44" */
  date: string
  camera: string
  lens: string
}

export function buildStrapParts(exif: FrameExifInput, s: FrameSettings): StrapParts {
  const exposure = s.showExposure ? [formatIso(exif.iso), formatFStop(exif.fNumber), formatShutter(exif.exposureTime)].filter(Boolean).join(' ') : ''
  return {
    exposure,
    date: s.showDate ? formatDateTime(exif.capturedAt) : '',
    camera: s.showCamera ? joinMakeModel(exif.make, exif.model) : '',
    lens: s.showLens ? lensText(exif, s) : '',
  }
}

export function strapHasContent(p: StrapParts): boolean {
  return !!(p.exposure || p.date || p.camera || p.lens)
}

export interface StyleChrome {
  /** bar height as a fraction of the output's short side (two-line height; collapses for one line) */
  barFrac: number
  /** photo margin (film style only) as a fraction of the short side, 0 for the others */
  marginFrac: number
  divider: boolean
  align: 'left' | 'center'
}

const STYLE: Record<FrameStyle, StyleChrome> = {
  minimal: { barFrac: 0.05, marginFrac: 0, divider: false, align: 'left' },
  strap: { barFrac: 0.1, marginFrac: 0, divider: true, align: 'left' },
  film: { barFrac: 0.15, marginFrac: 0.035, divider: false, align: 'center' },
}

const ONE_LINE_SHRINK = 0.62 // a single-line bar doesn't need the full two-line height
const PRIMARY_RATIO = 0.36 // font size as a fraction of the bar height
const SECONDARY_RATIO = 0.22
const ONE_LINE_RATIO = 0.4

export interface FrameGeometry {
  /** output canvas size including the frame */
  outW: number
  outH: number
  /** where the photo is drawn */
  photoX: number
  photoY: number
  photoW: number
  photoH: number
  /** the info bar's box (full width) */
  barX: number
  barY: number
  barW: number
  barH: number
  /** true ⇒ draw `lines.primary + '   ' + lines.secondary` as one centred-vertically line at `primaryPx` */
  oneLine: boolean
  primaryPx: number
  secondaryPx: number
  divider: boolean
  align: 'left' | 'center'
}

/** Pure geometry for a photo of size `w`×`h`, framed per `style`/`position` given what the two lines contain. */
export function computeFrameGeometry(w: number, h: number, style: FrameStyle, position: FramePosition, lines: FrameLines): FrameGeometry {
  const chrome = STYLE[style]
  const bothLines = lines.primary.length > 0 && lines.secondary.length > 0
  const oneLine = style === 'minimal' || !bothLines
  const short = Math.min(w, h)
  const margin = Math.round(short * chrome.marginFrac)
  const barH = Math.round(short * chrome.barFrac * (oneLine && style !== 'film' ? ONE_LINE_SHRINK : 1))
  const outW = w + margin * 2
  const outH = h + margin * 2 + barH
  const photoY = position === 'top' ? margin + barH : margin
  return {
    outW,
    outH,
    photoX: margin,
    photoY,
    photoW: w,
    photoH: h,
    barX: 0,
    barY: position === 'top' ? 0 : photoY + h,
    barW: outW,
    barH,
    oneLine,
    primaryPx: Math.max(8, Math.round(barH * (oneLine ? ONE_LINE_RATIO : PRIMARY_RATIO))),
    secondaryPx: Math.max(7, Math.round(barH * SECONDARY_RATIO)),
    divider: chrome.divider && !oneLine,
    align: chrome.align,
  }
}
