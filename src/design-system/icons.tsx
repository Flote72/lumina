import type { SVGProps } from 'react'

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 14,
  height: 14,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...p,
})

export const ChevronIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6 3.5 10.5 8 6 12.5" />
  </svg>
)
export const PanelLeftIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="2" y="3" width="12" height="10" rx="1.5" />
    <path d="M6 3v10" />
  </svg>
)
export const PanelRightIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="2" y="3" width="12" height="10" rx="1.5" />
    <path d="M10 3v10" />
  </svg>
)
export const FilmstripIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="2" y="3" width="12" height="10" rx="1.5" />
    <path d="M2 10h12" />
  </svg>
)
export const ImageIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base({ width: 40, height: 40, strokeWidth: 1, ...p })}>
    <rect x="2" y="3" width="12" height="10" rx="1.5" />
    <circle cx="5.6" cy="6.6" r="1" />
    <path d="m2.5 12 3.6-3.4 2.6 2.4 2-1.8 3.3 2.8" />
  </svg>
)
export const AlertIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M8 2.5 14 13H2z" />
    <path d="M8 6.5v3M8 11.3v.2" />
  </svg>
)
