import type { ColorLabel } from '@/catalog/db'

export const LABEL_COLOR: Record<Exclude<ColorLabel, 'none'>, string> = {
  red: '#e5544a',
  yellow: '#e2c53a',
  green: '#4cb860',
  blue: '#4a7fe0',
  purple: '#9a5ad8',
}
