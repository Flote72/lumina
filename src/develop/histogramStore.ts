import { create } from 'zustand'
import type { HistogramData } from '@/core/histogram/histogram'
import { renderClient } from '@/render/client'
import { useToastStore } from '@/store/toast'

export const useHistogram = create<{ data: HistogramData | null }>()(() => ({ data: null }))

renderClient.onHistogram = (data) => useHistogram.setState({ data })
renderClient.onError = (msg) => useToastStore.getState().push(msg, 'error')
