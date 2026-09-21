import type { ButtonHTMLAttributes } from 'react'

type Variant = 'default' | 'primary' | 'ghost'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  active?: boolean
}

const variants: Record<Variant, string> = {
  default: 'bg-bg-2 text-fg-0 hover:bg-bg-3 border border-line',
  primary: 'bg-accent text-accent-fg font-semibold hover:brightness-110',
  ghost: 'text-fg-1 hover:text-fg-0 hover:bg-bg-2',
}

export function Button({ variant = 'default', active, className = '', type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      aria-pressed={active}
      className={`inline-flex h-6 items-center justify-center gap-1.5 rounded-[4px] px-2.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${variants[variant]} ${active ? 'bg-bg-3 !text-accent' : ''} ${className}`}
      {...rest}
    />
  )
}
