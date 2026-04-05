import { useRef, useCallback } from 'react'
import { CreateMLCEngine, type MLCEngine } from '@mlc-ai/web-llm'
import { useLlmStore } from '@/stores/llm'

const RAG_SYSTEM_PROMPT = `You are a personal knowledge assistant. Answer the user's question based ONLY on the provided context from their notes, articles, and documents. If the context doesn't contain enough information to answer, say so honestly. Be concise and direct. Cite which piece of context you're drawing from when relevant.`

/**
 * Hook that manages a WebLLM engine instance and provides
 * generate() for RAG-grounded text generation.
 */
export function useWebLLM() {
  const engineRef = useRef<MLCEngine | null>(null)
  const store = useLlmStore()

  const loadModel = useCallback(async () => {
    if (engineRef.current || store.isLoading) return

    if (!store.webgpuSupported) {
      store.setError('WebGPU is not supported in this browser')
      return
    }

    store.setLoading(true)
    store.setError(null)

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
  ): AsyncGenerator<string> {
    if (!engineRef.current) {
      throw new Error('Model not loaded')
    }

    // Build context from chunks
    const context = chunks
      .map((chunk, i) => `[Source ${i + 1}]\n${chunk}`)
      .join('\n\n')

    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: `${RAG_SYSTEM_PROMPT}\n\nContext:\n${context}` },
    ]

    // Add conversation history (keep it short to stay under 8K tokens)
    if (history) {
      const recentHistory = history.slice(-4) // last 2 exchanges
      for (const msg of recentHistory) {
        messages.push({ role: msg.role, content: msg.content })
      }
    }

    messages.push({ role: 'user', content: userMessage })

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
  }, [])

  /**
   * Generate a complete (non-streaming) response.
   */
  const generateComplete = useCallback(async (
    systemPrompt: string,
    userMessage: string,
  ): Promise<string> => {
    if (!engineRef.current) {
      throw new Error('Model not loaded')
    }

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
