import exifr from 'exifr'

export interface ExifSummary {
  capturedAt: number | null
  camera: string
  lens: string
  iso: number | null
  exposureTime: number | null
  fNumber: number | null
  focalLength: number | null
  raw: Record<string, unknown> | null
}

const EMPTY: ExifSummary = { capturedAt: null, camera: '', lens: '', iso: null, exposureTime: null, fNumber: null, focalLength: null, raw: null }

const PICK = [
  'Make', 'Model', 'LensModel', 'LensMake', 'ISO', 'ExposureTime', 'FNumber', 'FocalLength', 'FocalLengthIn35mmFormat',
  'DateTimeOriginal', 'CreateDate', 'ExposureCompensation', 'ExposureProgram', 'MeteringMode', 'Flash', 'WhiteBalance',
  'Software', 'Artist', 'Copyright', 'ExifImageWidth', 'ExifImageHeight', 'Orientation', 'ColorSpace',
]

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Camera makers repeat themselves in the model string ("Canon Canon EOS…"). */
export function joinCamera(make?: unknown, model?: unknown): string {
  const mk = typeof make === 'string' ? make.trim() : ''
  const md = typeof model === 'string' ? model.trim() : ''
  if (!md) return mk
  return md.toLowerCase().startsWith(mk.split(' ')[0]!.toLowerCase()) ? md : `${mk} ${md}`.trim()
}

export async function readExif(file: File): Promise<ExifSummary> {
  try {
    const d = (await exifr.parse(file, { pick: PICK, translateValues: false })) as Record<string, unknown> | undefined
    if (!d) return EMPTY
    const date = d.DateTimeOriginal ?? d.CreateDate
    const raw: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(d)) raw[k] = v instanceof Date ? v.getTime() : v
    return {
      capturedAt: date instanceof Date ? date.getTime() : null,
      camera: joinCamera(d.Make, d.Model),
      lens: typeof d.LensModel === 'string' ? d.LensModel.trim() : '',
      iso: num(d.ISO),
      exposureTime: num(d.ExposureTime),
      fNumber: num(d.FNumber),
      focalLength: num(d.FocalLength),
      raw,
    }
  } catch {
    return EMPTY
  }
}
