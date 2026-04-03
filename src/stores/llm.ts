import { create } from 'zustand'

interface LlmStore {
  isLoading: boolean
  isReady: boolean
  modelName: string
  loadProgress: number
  webgpuSupported: boolean
}

export const useLlmStore = create<LlmStore>()(() => ({
  isLoading: false,
  isReady: false,
  modelName: 'qwen3.5-2b',
  loadProgress: 0,
  webgpuSupported: typeof navigator !== 'undefined' && 'gpu' in navigator,
}))
