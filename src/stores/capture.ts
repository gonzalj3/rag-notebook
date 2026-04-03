import { create } from 'zustand'

export type CaptureStatus = 'processing' | 'embedding' | 'stored'

export interface RecentCapture {
  id: string
  title: string
  mode: string
  status: CaptureStatus
  timestamp: number
}

interface CaptureStore {
  recentCaptures: RecentCapture[]
  addCapture: (capture: Omit<RecentCapture, 'id' | 'timestamp'>) => string
  updateStatus: (id: string, status: CaptureStatus) => void
}

let nextId = 1

export const useCaptureStore = create<CaptureStore>()((set) => ({
  recentCaptures: [],
  addCapture: (capture) => {
    const id = `capture-${nextId++}`
    set((state) => ({
      recentCaptures: [
        { ...capture, id, timestamp: Date.now() },
        ...state.recentCaptures,
      ],
    }))
    return id
  },
  updateStatus: (id, status) => {
    set((state) => ({
      recentCaptures: state.recentCaptures.map((c) =>
        c.id === id ? { ...c, status } : c,
      ),
    }))
  },
}))
