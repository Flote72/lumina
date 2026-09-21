import { useUiStore } from '@/store/ui'
import { en } from './en'
import { ko, type TKey } from './ko'

export type Lang = 'ko' | 'en'
export type { TKey }

const dicts: Record<Lang, Record<TKey, string>> = { ko, en }

export function translate(lang: Lang, key: TKey, vars?: Record<string, string | number>): string {
  let s = dicts[lang][key]
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
  return s
}

export function useT() {
  const lang = useUiStore((s) => s.lang)
  return (key: TKey, vars?: Record<string, string | number>) => translate(lang, key, vars)
}
