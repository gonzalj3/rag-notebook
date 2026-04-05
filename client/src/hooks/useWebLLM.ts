import { useRef, useCallback, useEffect } from 'react'
import { CreateMLCEngine, type MLCEngine } from '@mlc-ai/web-llm'
import { useLlmStore } from '@/stores/llm'

const RAG_SYSTEM_PROMPT = `You are a personal knowledge assistant for a RAG Notebook app. The user has a personal corpus of articles, notes, and documents. You can answer questions about what's in their corpus, summarize content, and help them think through ideas.

Answer based on the provided context. If the context doesn't contain enough information, say so. Be concise and direct. Cite which source you're drawing from when relevant.`

/** Models that use transformers.js Web Worker instead of WebLLM */
const WORKER_MODELS = new Set(['gemma-4-E2B-it'])

function isWorkerModel(modelName: string): boolean {
  return WORKER_MODELS.has(modelName)
}

type WorkerMessageResolve = {
  resolve: (chunks: string[]) => void
  reject: (err: Error) => void
  chunks: string[]
}

/**
 * Hook that manages LLM inference via WebLLM or transformers.js (Web Worker).
 * Automatically routes based on model selection.
 */
export function useWebLLM() {
  const engineRef = useRef<MLCEngine | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const pendingGenRef = useRef<WorkerMessageResolve | null>(null)
  const store = useLlmStore()

  // Clean up worker on unmount
  useEffect(() => {
    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  const loadModel = useCallback(async () => {
    if (store.isLoading) return

    // Tear down any existing engine/worker
    workerRef.current?.terminate()
    workerRef.current = null
    engineRef.current = null

    if (!store.webgpuSupported) {
      store.setError('WebGPU is not supported in this browser')
      return
    }

    store.setLoading(true)
    store.setReady(false)
    store.setError(null)

    if (isWorkerModel(store.modelName)) {
      // --- Transformers.js via Web Worker (Gemma 4) ---
      const worker = new Worker(new URL('../lib/llm.worker.ts', import.meta.url), {
        type: 'module',
      })
      workerRef.current = worker

      return new Promise<void>((resolve) => {
        worker.addEventListener('message', (e: MessageEvent) => {
          const { status, data, progress } = e.data

          switch (status) {
            case 'webgpu_ok':
              store.setProgress(0, 'Loading model...')
              worker.postMessage({ type: 'load' })
              break
            case 'loading':
              store.setProgress(progress ?? 0, data ?? 'Loading...')
              break
            case 'ready':
              store.setReady(true)
              store.setLoading(false)
              resolve()
              break
            case 'error':
              store.setError(data ?? 'Unknown error')
              store.setLoading(false)
              resolve()
              break
            case 'update':
              // Streaming token — forward to pending generator
              if (pendingGenRef.current) {
                pendingGenRef.current.chunks.push(e.data.output)
              }
              break
            case 'complete':
              if (pendingGenRef.current) {
                pendingGenRef.current.resolve(pendingGenRef.current.chunks)
                pendingGenRef.current = null
              }
              break
          }
        })

        worker.postMessage({ type: 'check' })
      })
    }

    // --- WebLLM backend (Qwen, Gemma 2) ---
    try {
      const engine = await CreateMLCEngine(store.modelName, {
        initProgressCallback: (report) => {
          store.setProgress(report.progress, report.text)
        },
      })
      engineRef.current = engine
      store.setReady(true)
    } catch (err) {
      store.setError(err instanceof Error ? err.message : 'Failed to load model')
    } finally {
      store.setLoading(false)
    }
  }, [store])

  /**
   * Generate a response grounded in retrieved chunks.
   * Yields tokens as they stream in.
   */
  const generate = useCallback(async function* (
    userMessage: string,
    chunks: string[],
    history?: { role: 'user' | 'assistant'; content: string }[],
    corpusSummary?: string,
  ): AsyncGenerator<string> {
    // Build context
    const context = chunks
      .map((chunk, i) => `[Source ${i + 1}]\n${chunk}`)
      .join('\n\n')

    let systemContent = RAG_SYSTEM_PROMPT
    if (corpusSummary) {
      systemContent += `\n\nCorpus Overview:\n${corpusSummary}`
    }
    systemContent += `\n\nRetrieved Context:\n${context}`

    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemContent },
    ]

    if (history) {
      for (const msg of history.slice(-4)) {
        messages.push({ role: msg.role, content: msg.content })
      }
    }
    messages.push({ role: 'user', content: userMessage })

    if (workerRef.current) {
      // --- Worker path: accumulate streaming tokens, yield as they arrive ---
      const worker = workerRef.current
      const chunkQueue: string[] = []
      let done = false
      let error: Error | null = null
      let resolveNext: (() => void) | null = null

      const handler = (e: MessageEvent) => {
        const { status, data, output } = e.data
        if (status === 'update') {
          chunkQueue.push(output)
          resolveNext?.()
          resolveNext = null
        } else if (status === 'complete') {
          done = true
          resolveNext?.()
          resolveNext = null
        } else if (status === 'error') {
          error = new Error(data ?? 'Generation error')
          done = true
          resolveNext?.()
          resolveNext = null
        }
      }
      worker.addEventListener('message', handler)
      worker.postMessage({ type: 'generate', data: messages })

      try {
        while (!done || chunkQueue.length > 0) {
          if (chunkQueue.length === 0 && !done) {
            await new Promise<void>((r) => { resolveNext = r })
          }
          while (chunkQueue.length > 0) {
            yield chunkQueue.shift()!
          }
        }
        if (error) throw error
      } finally {
        worker.removeEventListener('message', handler)
      }
    } else if (engineRef.current) {
      // --- WebLLM path (native streaming) ---
      const response = await engineRef.current.chat.completions.create({
        messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 4096,
      })

      for await (const chunk of response) {
        const delta = chunk.choices[0]?.delta?.content
        if (delta) {
          yield delta
        }
      }
    } else {
      throw new Error('Model not loaded')
    }
  }, [])

  /**
   * Generate a complete (non-streaming) response.
   */
  const generateComplete = useCallback(async (
    systemPrompt: string,
    userMessage: string,
  ): Promise<string> => {
    if (workerRef.current) {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ]
      let fullText = ''
      for await (const token of (async function* () {
        const worker = workerRef.current!
        const chunkQueue: string[] = []
        let done = false
        let resolveNext: (() => void) | null = null

        const handler = (e: MessageEvent) => {
          const { status, output } = e.data
          if (status === 'update') {
            chunkQueue.push(output)
            resolveNext?.()
            resolveNext = null
          } else if (status === 'complete' || status === 'error') {
            done = true
            resolveNext?.()
            resolveNext = null
          }
        }
        worker.addEventListener('message', handler)
        worker.postMessage({ type: 'generate', data: messages })

        try {
          while (!done || chunkQueue.length > 0) {
            if (chunkQueue.length === 0 && !done) {
              await new Promise<void>((r) => { resolveNext = r })
            }
            while (chunkQueue.length > 0) yield chunkQueue.shift()!
          }
        } finally {
          worker.removeEventListener('message', handler)
        }
      })()) {
        fullText += token
      }
      return fullText
    }

    if (!engineRef.current) throw new Error('Model not loaded')

    const response = await engineRef.current.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    })

    return response.choices[0]?.message?.content ?? ''
  }, [])

  return {
    loadModel,
    generate,
    generateComplete,
    isReady: store.isReady,
    isLoading: store.isLoading,
    loadProgress: store.loadProgress,
    loadStatus: store.loadStatus,
    error: store.error,
    modelName: store.modelName,
    webgpuSupported: store.webgpuSupported,
  }
}
