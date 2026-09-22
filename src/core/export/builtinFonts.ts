/**
 * Fonts actually bundled with the app (public/fonts/), for the EXIF frame caption. Unlike a
 * user-uploaded custom font (store/exportSettings.ts), these ship in the repo because their license
 * explicitly allows it — see each entry's `license`/`ofl` file next to it.
 */
export interface BuiltinFont {
  key: string
  name: string
  /** path under public/, relative — combine with import.meta.env.BASE_URL to fetch it */
  file: string
}

export const BUILTIN_FRAME_FONTS: BuiltinFont[] = [
  { key: 'alumni-sans-pinstripe', name: 'Alumni Sans Pinstripe', file: 'fonts/alumni-sans-pinstripe/AlumniSansPinstripe-Regular.ttf' },
]

export function builtinFontUrl(file: string): string {
  return `${import.meta.env.BASE_URL}${file}`
}

/** The EXIF-frame caption font. Fixed (not user-selectable) — see BUILTIN_FRAME_FONTS above for why it can ship. */
export const FRAME_FONT: BuiltinFont = BUILTIN_FRAME_FONTS[0]!
