/**
 * File selection and drop handling. All browser-specific file APIs live here so a Tauri build
 * can replace this module (native dialogs / fs) without touching the UI.
 */

const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif', 'heic', 'heif', 'gif', 'bmp'])
export const RAW_EXT = new Set(['cr2', 'cr3', 'crw', 'nef', 'nrw', 'arw', 'sr2', 'dng', 'raf', 'orf', 'rw2', 'pef', 'srw', 'x3f', '3fr', 'erf', 'mrw', 'kdc', 'dcr', 'iiq'])

const ext = (name: string) => name.split('.').pop()?.toLowerCase() ?? ''

export interface FileSplit {
  images: File[]
  raw: File[]
  skipped: number
}

export function splitFiles(files: File[]): FileSplit {
  const images: File[] = []
  const raw: File[] = []
  let skipped = 0
  for (const f of files) {
    const e = ext(f.name)
    if (RAW_EXT.has(e)) raw.push(f)
    else if (IMAGE_EXT.has(e) || f.type.startsWith('image/')) images.push(f)
    else skipped++
  }
  return { images, raw, skipped }
}

export const ACCEPT = `image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.avif,.heic,.heif,${[...RAW_EXT].map((e) => `.${e}`).join(',')}`

function inputPick(opts: { multiple?: boolean; directory?: boolean }): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    if (opts.directory) input.setAttribute('webkitdirectory', '')
    else input.accept = ACCEPT
    input.onchange = () => resolve(Array.from(input.files ?? []))
    input.oncancel = () => resolve([])
    input.click()
  })
}

export async function pickFiles(): Promise<File[]> {
  return inputPick({ multiple: true })
}

async function walkDirectoryHandle(dir: FileSystemDirectoryHandle, out: File[]) {
  // Async iteration over directory handles is supported where showDirectoryPicker exists.
  const iter = dir as unknown as { values(): AsyncIterable<FileSystemHandle> }
  for await (const entry of iter.values()) {
    if (entry.kind === 'file') out.push(await (entry as FileSystemFileHandle).getFile())
    else await walkDirectoryHandle(entry as FileSystemDirectoryHandle, out)
  }
}

export async function pickFolder(): Promise<File[]> {
  const w = window as unknown as { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> }
  if (w.showDirectoryPicker) {
    try {
      const dir = await w.showDirectoryPicker()
      const out: File[] = []
      await walkDirectoryHandle(dir, out)
      return out
    } catch {
      return [] // user cancelled
    }
  }
  return inputPick({ directory: true })
}

function readEntry(entry: FileSystemEntry, out: File[]): Promise<void> {
  return new Promise((resolve) => {
    if (entry.isFile) {
      ;(entry as FileSystemFileEntry).file(
        (f) => (out.push(f), resolve()),
        () => resolve(),
      )
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader()
      const readAll = () =>
        reader.readEntries(async (batch) => {
          if (!batch.length) return resolve()
          await Promise.all(batch.map((b) => readEntry(b, out)))
          readAll()
        }, () => resolve())
      readAll()
    } else resolve()
  })
}

/** Files (including folders, recursively) from a drop event. */
export async function collectDroppedFiles(dt: DataTransfer): Promise<File[]> {
  const out: File[] = []
  const entries = Array.from(dt.items ?? [])
    .map((i) => (i.kind === 'file' ? i.webkitGetAsEntry?.() : null))
    .filter((e): e is FileSystemEntry => !!e)
  if (entries.length) await Promise.all(entries.map((e) => readEntry(e, out)))
  else out.push(...Array.from(dt.files))
  return out
}
