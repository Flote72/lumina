import Dexie, { type EntityTable } from 'dexie'
import type { EditParams } from '@/core/params/params'

export type Flag = 'none' | 'pick' | 'reject'
export type ColorLabel = 'none' | 'red' | 'yellow' | 'green' | 'blue' | 'purple'

export interface PhotoRow {
  id: string
  name: string
  size: number
  mime: string
  width: number
  height: number
  addedAt: number
  capturedAt: number | null
  rating: number
  flag: Flag
  label: ColorLabel
  keywords: string[]
  camera: string
  lens: string
  iso: number | null
  exposureTime: number | null
  fNumber: number | null
  focalLength: number | null
  hasEdits: boolean
  /** RAW file: the editing pipeline works from a developed copy (see raw/developRaw.ts) */
  raw?: boolean
  rawMethod?: 'libraw' | 'preview'
  exif: Record<string, unknown> | null
}

export interface HistoryEntry {
  label: string
  params: EditParams
}
export interface HistoryRow {
  photoId: string
  entries: HistoryEntry[]
  index: number
}
export interface SnapshotRow {
  id: string
  photoId: string
  name: string
  params: EditParams
  createdAt: number
}
export interface PresetRow {
  id: string
  name: string
  group: string
  patch: unknown
  source: 'user' | 'xmp' | 'json'
  createdAt: number
}
export interface CollectionRow {
  id: string
  name: string
  createdAt: number
}

class LuminaDB extends Dexie {
  photos!: EntityTable<PhotoRow, 'id'>
  thumbs!: EntityTable<{ id: string; blob: Blob }, 'id'>
  edits!: EntityTable<{ photoId: string; params: EditParams; updatedAt: number }, 'photoId'>
  history!: EntityTable<HistoryRow, 'photoId'>
  snapshots!: EntityTable<SnapshotRow, 'id'>
  presets!: EntityTable<PresetRow, 'id'>
  collections!: EntityTable<CollectionRow, 'id'>
  collectionItems!: EntityTable<{ collectionId: string; photoId: string }, never>
  /** Fallback storage for originals when OPFS is unavailable. */
  blobs!: EntityTable<{ id: string; blob: Blob }, 'id'>

  constructor() {
    super('lumina')
    this.version(1).stores({
      photos: 'id, addedAt, capturedAt, rating, flag, label, camera, lens, iso, *keywords',
      thumbs: 'id',
      edits: 'photoId',
      history: 'photoId',
      snapshots: 'id, photoId',
      presets: 'id, group',
      collections: 'id',
      collectionItems: '[collectionId+photoId], collectionId, photoId',
      blobs: 'id',
    })
  }
}

export const db = new LuminaDB()
