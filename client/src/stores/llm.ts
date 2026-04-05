import { create } from 'zustand'

interface LlmStore {
  isLoading: boolean
  isReady: boolean
  modelName: string
  loadProgress: number
  loadStatus: string
  webgpuSupported: boolean
  error: string | null
  setLoading: (loading: boolean) => void
  setReady: (ready: boolean) => void
  setProgress: (progress: number, status: string) => void
  setError: (error: string | null) => void
  setModelName: (name: string) => void
}

export const useLlmStore = create<LlmStore>()((set) => ({
  isLoading: false,
  isReady: false,
  modelName: 'Qwen3-1.7B-q4f16_1-MLC',
  loadProgress: 0,
  loadStatus: '',
  webgpuSupported: typeof navigator !== 'undefined' && 'gpu' in navigator,
  error: null,
  setLoading: (isLoading) => set({ isLoading }),
  setReady: (isReady) => set({ isReady }),
  setProgress: (loadProgress, loadStatus) => set({ loadProgress, loadStatus }),
  setError: (error) => set({ error }),
  setModelName: (modelName) => set({ modelName }),
}))
