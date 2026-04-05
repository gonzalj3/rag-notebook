/**
 * Web Worker for transformers.js-based models (Gemma 4).
 *
 * Runs in a Worker so Vite processes it through a different pipeline
 * than main-thread imports — this sidesteps the optimizeDeps issue
 * that strips the onnxruntime-web/webgpu subpath.
 *
 * Communicates with the main thread via postMessage:
 *   IN:  { type: 'check' | 'load' | 'generate' | 'interrupt' | 'reset', data? }
 *   OUT: { status: 'webgpu_ok' | 'loading' | 'ready' | 'start' | 'update' | 'complete' | 'error', ... }
 */

import {
  AutoTokenizer,
  AutoModelForCausalLM,
  TextStreamer,
  InterruptableStoppingCriteria,
} from '@huggingface/transformers'

const MODEL_ID = 'onnx-community/gemma-4-E2B-it-ONNX'

class TextGenerationPipeline {
  static tokenizer: any = null
  static model: any = null

  static async getInstance(progress_callback?: (x: unknown) => void) {
    if (!this.tokenizer) {
      this.tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID, {
        progress_callback,
      } as any)
    }
    if (!this.model) {
      this.model = await AutoModelForCausalLM.from_pretrained(MODEL_ID, {
        dtype: 'q4f16', // q4 causes buffer overflow in browser
        device: 'webgpu',
        progress_callback,
      } as any)
    }
    return [this.tokenizer, this.model] as const
  }
}

const stopping_criteria = new InterruptableStoppingCriteria()

async function check() {
  try {
    if (!self.navigator?.gpu) {
      throw new Error('WebGPU not available in this browser')
    }
    const adapter = await self.navigator.gpu.requestAdapter()
    if (!adapter) throw new Error('WebGPU adapter not available')

    const limits = adapter.limits
    self.postMessage({
      status: 'webgpu_ok',
      data: {
        maxBufferSize: limits.maxBufferSize,
        maxStorageBufferBindingSize: limits.maxStorageBufferBindingSize,
      },
    })
  } catch (e) {
    self.postMessage({ status: 'error', data: e instanceof Error ? e.message : String(e) })
  }
}

async function load() {
  try {
    self.postMessage({ status: 'loading', data: 'Initializing...' })

    const [tokenizer, model] = await TextGenerationPipeline.getInstance((x: any) => {
      // Forward progress events to main thread
      if (x.status === 'progress') {
        self.postMessage({
          status: 'loading',
          data: `${x.file ?? 'model'}: ${Math.round((x.progress ?? 0))}%`,
          progress: (x.progress ?? 0) / 100,
        })
      } else if (x.status === 'ready' || x.status === 'done') {
        self.postMessage({ status: 'loading', data: 'Finalizing...', progress: 0.95 })
      }
    })

    // Warmup pass compiles WebGPU shaders — skipping this makes first token very slow
    self.postMessage({ status: 'loading', data: 'Warming up shaders...', progress: 0.98 })
    const warmup = tokenizer('a')
    await model.generate({ ...warmup, max_new_tokens: 1 })

    self.postMessage({ status: 'ready' })
  } catch (e) {
    self.postMessage({ status: 'error', data: e instanceof Error ? e.message : String(e) })
  }
}

async function generate(messages: { role: string; content: string }[]) {
  try {
    const [tokenizer, model] = await TextGenerationPipeline.getInstance()

    const inputs = tokenizer.apply_chat_template(messages, {
      add_generation_prompt: true,
      return_dict: true,
    })

    let startTime: number | undefined
    let numTokens = 0

    const streamer = new TextStreamer(tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (output: string) => {
        self.postMessage({
          status: 'update',
          output,
          tps: numTokens > 1 && startTime ? (numTokens / (performance.now() - startTime)) * 1000 : null,
          numTokens,
        })
      },
      token_callback_function: () => {
        startTime ??= performance.now()
        numTokens++
      },
    } as any)

    self.postMessage({ status: 'start' })

    const result = await model.generate({
      ...inputs,
      do_sample: false,
      max_new_tokens: 1024,
      streamer,
      stopping_criteria,
      return_dict_in_generate: true,
    } as any)

    const decoded = tokenizer.batch_decode(result.sequences, {
      skip_special_tokens: true,
    })

    self.postMessage({ status: 'complete', output: decoded })
  } catch (e) {
    self.postMessage({ status: 'error', data: e instanceof Error ? e.message : String(e) })
  }
}

self.addEventListener('message', async (e: MessageEvent) => {
  const { type, data } = e.data
  switch (type) {
    case 'check':
      await check()
      break
    case 'load':
      await load()
      break
    case 'generate':
      stopping_criteria.reset()
      await generate(data)
      break
    case 'interrupt':
      stopping_criteria.interrupt()
      break
    case 'reset':
      stopping_criteria.reset()
      break
  }
})
