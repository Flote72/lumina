import { create } from 'zustand'

export interface Toast {
  id: number
  kind: 'info' | 'error'
  text: string
}

interface ToastState {
  toasts: Toast[]
  push: (text: string, kind?: Toast['kind']) => void
  dismiss: (id: number) => void
}

let n = 1
export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  push: (text, kind = 'info') => {
    const id = n++
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, text }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 6000)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
