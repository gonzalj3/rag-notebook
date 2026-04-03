import { useCallback } from 'react'

const TAG_KEYWORDS: Record<string, string[]> = {
  rag: ['rag', 'retrieval', 'augmented', 'vector', 'embedding', 'pgvector', 'chunk'],
  agents: ['agent', 'agentic', 'tool use', 'function calling', 'mcp'],
  evals: ['eval', 'benchmark', 'metric', 'accuracy', 'f1', 'rouge'],
  infra: ['docker', 'deploy', 'kubernetes', 'ci/cd', 'pipeline', 'server', 'api'],
  tcf: ['tcf', 'founder', 'startup', 'yc', 'venture'],
  career: ['career', 'job', 'interview', 'resume', 'portfolio'],
  learning: ['learn', 'study', 'course', 'tutorial', 'book', 'paper'],
  llm: ['llm', 'gpt', 'claude', 'gemma', 'qwen', 'transformer', 'attention', 'fine-tune', 'lora'],
}

export function useAutoTags() {
  const classify = useCallback((text: string): string[] => {
    const lower = text.toLowerCase()
    const matched: string[] = []

    for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
      if (keywords.some((kw) => lower.includes(kw))) {
        matched.push(tag)
      }
    }

    return matched
  }, [])

  return { classify }
}
