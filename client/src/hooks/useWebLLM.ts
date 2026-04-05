import { useRef, useCallback } from 'react'
import { CreateMLCEngine, type MLCEngine } from '@mlc-ai/web-llm'
import { useLlmStore } from '@/stores/llm'

const RAG_SYSTEM_PROMPT = `You are a personal knowledge assistant for a RAG Notebook app. The user has a personal corpus of articles, notes, and documents. You can answer questions about what's in their corpus, summarize content, and help them think through ideas.

Answer based on the provided context. If the context doesn't contain enough information, say so. Be concise and direct. Cite which source you're drawing from when relevant.`

/** Models that use transformers.js instead of WebLLM */
const TRANSFORMERS_JS_MODELS: Record<string, string> = {
  'gemma-4-E2B-it': 'onnx-community/gemma-4-E2B-it-ONNX',
}

function isTransformersModel(modelName: string): boolean {
  return modelName in TRANSFORMERS_JS_MODELS
}

/**
 * Hook that manages LLM inference via WebLLM or transformers.js.
 * Automatically picks the right backend based on the selected model.
 */
export function useWebLLM() {
  const engineRef = useRef<MLCEngine | null>(null)
  const transformersRef = useRef<{ generator: any } | null>(null)
  const store = useLlmStore()

  const loadModel = useCallback(async () => {
    if (store.isLoading) return

    // Reset previous engine
    engineRef.current = null
    transformersRef.current = null

    if (!store.webgpuSupported) {
      store.setError('WebGPU is not supported in this browser')
      return
    }

    store.setLoading(true)
    store.setReady(false)
    store.setError(null)

    try {
      if (isTransformersModel(store.modelName)) {
        // --- Transformers.js backend (Gemma 4) ---
        const { pipeline } = await import('@huggingface/transformers')
        const modelId = TRANSFORMERS_JS_MODELS[store.modelName]

        store.setProgress(0, `Loading ${store.modelName}...`)

        // Try WebGPU first, fall back to WASM if WebGPU init fails (e.g. Safari)
        let device: 'webgpu' | 'wasm' = 'webgpu'
        try {
          const gpu = navigator.gpu
          if (!gpu) throw new Error('No WebGPU')
          const adapter = await gpu.requestAdapter()
          if (!adapter) throw new Error('No adapter')
        } catch {
          device = 'wasm'
          store.setProgress(0, 'WebGPU unavailable, using WASM (slower)...')
        }

        const generator = await pipeline('text-generation', modelId, {
          dtype: device === 'webgpu' ? 'q4f16' : 'q4',
          device,
          progress_callback: (progress: any) => {
            if (progress.status === 'progress' && progress.total) {
              store.setProgress(progress.loaded / progress.total, `Downloading: ${progress.file}`)
            } else if (progress.status === 'ready') {
              store.setProgress(1, 'Model ready')
            }
          },
        }).catch(async (err: Error) => {
          // If WebGPU pipeline fails, retry with WASM
          if (device === 'webgpu') {
            store.setProgress(0, 'WebGPU failed, retrying with WASM...')
            return pipeline('text-generation', modelId, {
              dtype: 'q4',
              device: 'wasm',
              progress_callback: (progress: any) => {
                if (progress.status === 'progress' && progress.total) {
                  store.setProgress(progress.loaded / progress.total, `Downloading: ${progress.file}`)
                }
              },
            })
          }
          throw err
        })

        transformersRef.current = { generator }
        store.setReady(true)
      } else {
        // --- WebLLM backend (Qwen, Gemma 2) ---
        const engine = await CreateMLCEngine(store.modelName, {
          initProgressCallback: (report) => {
            store.setProgress(report.progress, report.text)
          },
        })
        engineRef.current = engine
        store.setReady(true)
      }
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

    if (transformersRef.current) {
      // --- Transformers.js path ---
      const { generator } = transformersRef.current
      const output = await generator(messages, {
        max_new_tokens: 1024,
        temperature: 0.7,
        do_sample: true,
        return_full_text: false,
      })
      // transformers.js returns the full text at once
      const text = output[0]?.generated_text
      if (typeof text === 'string') {
        yield text
      } else if (Array.isArray(text)) {
        // Chat format returns array of messages
        const lastMsg = text[text.length - 1]
        yield lastMsg?.content ?? ''
      }
    } else if (engineRef.current) {
      // --- WebLLM path (streaming) ---
      const response = await engineRef.current.chat.completions.create({
        messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 1024,
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
    if (transformersRef.current) {
      const { generator } = transformersRef.current
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ]
      const output = await generator(messages, {
        max_new_tokens: 1024,
        temperature: 0.7,
        do_sample: true,
        return_full_text: false,
      })
      const text = output[0]?.generated_text
      if (typeof text === 'string') return text
      if (Array.isArray(text)) {
        const lastMsg = text[text.length - 1]
        return lastMsg?.content ?? ''
      }
      return ''
    }

    if (!engineRef.current) throw new Error('Model not loaded')

    const response = await engineRef.current.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 1024,
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
