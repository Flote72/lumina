import { usePhotos } from '@/store/photos'
import { usePresets } from '@/store/presets'

const isPresetFile = (f: File) => /\.(xmp|json)$/i.test(f.name)

/**
 * Route dropped / picked files: `.xmp` and `.json` are presets (imported and applied to the current
 * selection), everything else is treated as photos.
 */
export async function handleIncomingFiles(files: File[]) {
  const presets = files.filter(isPresetFile)
  const rest = files.filter((f) => !isPresetFile(f))
  if (presets.length) await usePresets.getState().importFiles(presets, { apply: true })
  if (rest.length) usePhotos.getState().importFiles(rest)
}
