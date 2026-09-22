import { Zip, ZipPassThrough } from 'fflate'
import { renderTemplate } from '@/core/library/filter'
import { translate } from '@/i18n'
import { download } from '@/platform/download'
import { getVisibleIds, targetIds } from '@/store/library'
import { useExportSettings, type ExportScope } from '@/store/exportSettings'
import { usePhotos } from '@/store/photos'
import { useToastStore } from '@/store/toast'
import { useUiStore } from '@/store/ui'
import { cancelExports, exportPhoto } from './exportClient'

const EXT = { jpeg: 'jpg', png: 'png', webp: 'webp', avif: 'avif' } as const
let cancelled = false

export function exportIdsFor(scope: ExportScope): string[] {
  const p = usePhotos.getState()
  if (scope === 'all') return p.order.filter((id) => p.photos[id]?.status === 'ok')
  const ids = scope === 'visible' ? getVisibleIds() : targetIds()
  return ids.filter((id) => p.photos[id]?.status === 'ok')
}

/** File names for a list of photos, made unique within the batch. */
export function fileNames(ids: string[], template: string, ext: string): string[] {
  const photos = usePhotos.getState().photos
  const used = new Map<string, number>()
  return ids.map((id, i) => {
    const p = photos[id]!
    const base = renderTemplate(template, { name: p.name, seq: i + 1, date: p.capturedAt ?? p.addedAt, rating: p.rating, camera: p.camera })
    const n = used.get(base.toLowerCase()) ?? 0
    used.set(base.toLowerCase(), n + 1)
    return `${n ? `${base}_${n}` : base}.${ext}`
  })
}

export function cancelBatch() {
  cancelled = true
  cancelExports()
}

export async function runBatch() {
  const st = useExportSettings.getState()
  const lang = useUiStore.getState().lang
  const toast = useToastStore.getState().push
  const ids = exportIdsFor(st.scope)
  if (!ids.length || st.running) return

  const { options } = st
  const names = fileNames(ids, st.template, EXT[options.format])
  const photos = usePhotos.getState().photos
  cancelled = false
  st.setRun({
    running: true,
    summary: null,
    items: ids.map((id, i) => ({ id, name: names[i]!, status: 'waiting', progress: 0 })),
  })

  const wmBlob = options.watermark.enabled && options.watermark.kind === 'image' && st.watermarkImage ? await (await fetch(st.watermarkImage)).blob() : undefined

  const multi = ids.length > 1
  const chunks: Uint8Array[] = []
  let zip: Zip | null = null
  let zipDone: Promise<void> | null = null
  if (multi) {
    zipDone = new Promise<void>((resolve, reject) => {
      zip = new Zip((err, data, final) => {
        if (err) return reject(err)
        chunks.push(data)
        if (final) resolve()
      })
    })
  }

  let ok = 0
  let bad = 0
  let p3Fallback = false
  for (let i = 0; i < ids.length && !cancelled; i++) {
    const id = ids[i]!
    const patch = useExportSettings.getState().patchItem
    patch(id, { status: 'working' })
    try {
      const file = await usePhotos.getState().getFile(id)
      const params = usePhotos.getState().params[id]!
      const p = usePhotos.getState().photos[id]
      const exif = p ? { model: p.camera, lens: p.lens, focalLength: p.focalLength, fNumber: p.fNumber, exposureTime: p.exposureTime, iso: p.iso, capturedAt: p.capturedAt } : undefined
      const res = await exportPhoto({ file, params, options, watermarkImage: wmBlob, exif }, (f) => patch(id, { progress: f }))
      p3Fallback ||= res.p3Fallback
      if (multi) {
        const f = new ZipPassThrough(names[i]!)
        zip!.add(f)
        f.push(new Uint8Array(await res.blob.arrayBuffer()), true)
      } else {
        download(res.blob, names[i]!)
      }
      patch(id, { status: 'done', progress: 1 })
      ok++
    } catch (e) {
      if (cancelled) break
      patch(id, { status: 'error', message: (e as Error).message })
      bad++
    }
    void photos
  }

  if (multi) {
    ;(zip as Zip | null)?.end()
    await zipDone
    if (!cancelled && ok > 0) {
      const d = new Date()
      const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
      download(new Blob(chunks as BlobPart[], { type: 'application/zip' }), `lumina-export-${stamp}.zip`)
    }
  }

  const summary = cancelled ? translate(lang, 'ex.cancelled') : bad ? translate(lang, 'ex.finishedErrors', { ok, bad }) : translate(lang, 'ex.finished', { n: ok })
  useExportSettings.getState().setRun({ running: false, summary })
  if (p3Fallback) toast(translate(lang, 'ex.p3Fallback'))
}
