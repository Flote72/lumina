import { db } from '@/catalog/db'

/**
 * Originals are copied once into browser-private storage (OPFS, or IndexedDB as a fallback) and are
 * only ever read afterwards — edits live in JSON params, so the stored copy is never modified.
 * (Tauri build: replace with plain file paths.)
 */
const DIR = 'originals'

async function dir(create: boolean) {
  const root = await navigator.storage.getDirectory()
  return root.getDirectoryHandle(DIR, { create })
}

export async function saveOriginal(id: string, file: File): Promise<void> {
  try {
    const fh = await (await dir(true)).getFileHandle(id, { create: true })
    const w = await fh.createWritable()
    await w.write(file)
    await w.close()
    return
  } catch {
    /* OPFS unavailable or quota — fall back */
  }
  await db.blobs.put({ id, blob: file })
}

export async function readOriginal(id: string, name: string, mime: string): Promise<File> {
  try {
    const fh = await (await dir(false)).getFileHandle(id)
    const f = await fh.getFile()
    return new File([f], name, { type: mime || f.type })
  } catch {
    const row = await db.blobs.get(id)
    if (!row) throw new Error('Original file not found in local storage')
    return new File([row.blob], name, { type: mime })
  }
}

export async function deleteOriginal(id: string): Promise<void> {
  try {
    await (await dir(false)).removeEntry(id)
  } catch {
    /* not in OPFS */
  }
  await db.blobs.delete(id)
}
