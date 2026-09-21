import { pickFiles, pickFolder } from '@/platform/fileAccess'
import { usePhotos } from '@/store/photos'

export async function importFromFiles() {
  usePhotos.getState().importFiles(await pickFiles())
}
export async function importFromFolder() {
  usePhotos.getState().importFiles(await pickFolder())
}
