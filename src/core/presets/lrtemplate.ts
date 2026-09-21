import { translateSettings, type XmpPreset } from './xmp'

/**
 * Minimal Lua table-constructor parser — enough for Lightroom `.lrtemplate` files
 * (`s = { id = "…", value = { settings = { Exposure = 1.65, ToneCurve = { 1, 255, … } } } }`).
 * Supports strings, numbers, booleans, nil, nested tables, `[expr] = v`, comments.
 */
export function parseLua(src: string): unknown {
  let i = 0
  const n = src.length

  const skip = () => {
    for (;;) {
      while (i < n && /\s/.test(src[i]!)) i++
      if (src.startsWith('--', i)) {
        const long = /^--\[(=*)\[/.exec(src.slice(i, i + 40))
        if (long) {
          const end = src.indexOf(`]${long[1]}]`, i)
          i = end < 0 ? n : end + long[1]!.length + 2
        } else {
          while (i < n && src[i] !== '\n') i++
        }
      } else return
    }
  }

  const fail = (msg: string): never => {
    throw new Error(`Lua parse error at ${i}: ${msg}`)
  }

  const str = (): string => {
    const q = src[i++]!
    let out = ''
    while (i < n && src[i] !== q) {
      let c = src[i++]!
      if (c === '\\') {
        c = src[i++] ?? ''
        if (c === 'n') out += '\n'
        else if (c === 't') out += '\t'
        else if (c === 'r') out += '\r'
        else if (/\d/.test(c)) {
          let d = c
          while (d.length < 3 && /\d/.test(src[i] ?? '')) d += src[i++]
          out += String.fromCharCode(Number(d))
        } else out += c
      } else out += c
    }
    if (src[i] !== q) fail('unterminated string')
    i++
    return out
  }

  const value = (): unknown => {
    skip()
    const c = src[i]
    if (c === '{') return table()
    if (c === '"' || c === "'") return str()
    if (c === '[' && /^\[=*\[/.test(src.slice(i, i + 10))) {
      const m = /^\[(=*)\[/.exec(src.slice(i, i + 10))!
      const end = src.indexOf(`]${m[1]}]`, i)
      const s = src.slice(i + m[0].length, end)
      i = end + m[1]!.length + 2
      return s
    }
    const num = /^-?(?:0[xX][0-9a-fA-F]+|\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+)/.exec(src.slice(i, i + 40))
    if (num) {
      i += num[0].length
      return Number(num[0])
    }
    const id = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i, i + 40))
    if (id) {
      i += id[0].length
      if (id[0] === 'true') return true
      if (id[0] === 'false') return false
      if (id[0] === 'nil') return null
      return fail(`unexpected identifier ${id[0]}`)
    }
    return fail(`unexpected character ${JSON.stringify(c)}`)
  }

  const table = (): unknown => {
    i++ // {
    const arr: unknown[] = []
    const obj: Record<string, unknown> = {}
    let keyed = false
    for (;;) {
      skip()
      if (src[i] === '}') {
        i++
        break
      }
      if (i >= n) fail('unterminated table')
      let key: string | null = null
      if (src[i] === '[' && !/^\[=*\[/.test(src.slice(i, i + 10))) {
        i++
        key = String(value())
        skip()
        if (src[i++] !== ']') fail('expected ]')
        skip()
        if (src[i++] !== '=') fail('expected =')
      } else {
        const id = /^([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)/.exec(src.slice(i, i + 80))
        if (id) {
          key = id[1]!
          i += id[0].length
        }
      }
      const v = value()
      if (key !== null) {
        obj[key] = v
        keyed = true
      } else arr.push(v)
      skip()
      if (src[i] === ',' || src[i] === ';') i++
    }
    if (!keyed) return arr
    arr.forEach((v, k) => (obj[String(k + 1)] = v))
    return obj
  }

  skip()
  // `s = { … }`, `return { … }` or a bare table
  const head = /^(?:return\b|[A-Za-z_][A-Za-z0-9_]*\s*=)/.exec(src.slice(i, i + 80))
  if (head) i += head[0].length
  return value()
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** Translate a Lightroom `.lrtemplate` (Develop preset) into a sparse Lumina patch. */
export function parseLrTemplate(text: string): XmpPreset {
  const root = parseLua(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text)
  if (!isObj(root)) throw new Error('not a Lightroom preset')
  const settings = isObj(root.value) ? root.value.settings : undefined
  if (!isObj(settings)) throw new Error('no develop settings found')

  const scalars = new Map<string, string>()
  const seqs = new Map<string, string[]>()
  let masks = false
  for (const [k, v] of Object.entries(settings)) {
    if (typeof v === 'boolean') scalars.set(k, v ? 'True' : 'False')
    else if (typeof v === 'number' || typeof v === 'string') scalars.set(k, String(v))
    else if (Array.isArray(v) && /^ToneCurve/.test(k)) {
      // flat list x1, y1, x2, y2, … (0..255)
      const pairs: string[] = []
      for (let i = 0; i + 1 < v.length; i += 2) pairs.push(`${v[i]}, ${v[i + 1]}`)
      seqs.set(k, pairs)
    } else if (k === 'MaskGroupBasedCorrections') masks = true
  }
  const title = typeof root.title === 'string' ? root.title : typeof root.internalName === 'string' ? root.internalName : ''
  return { name: title.trim() || 'Imported preset', group: '', ...translateSettings(scalars, seqs, { masks, look: scalars.has('Look') }) }
}
