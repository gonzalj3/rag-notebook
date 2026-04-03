TAG_KEYWORDS: dict[str, list[str]] = {
    "rag": ["rag", "retrieval", "augmented", "vector", "embedding", "pgvector", "chunk"],
    "agents": ["agent", "agentic", "tool use", "function calling", "mcp"],
    "evals": ["eval", "benchmark", "metric", "accuracy", "f1", "rouge"],
    "infra": ["docker", "deploy", "kubernetes", "ci/cd", "pipeline", "server", "api"],
    "tcf": ["tcf", "founder", "startup", "yc", "venture"],
    "career": ["career", "job", "interview", "resume", "portfolio"],
    "learning": ["learn", "study", "course", "tutorial", "book", "paper"],
    "llm": ["llm", "gpt", "claude", "gemma", "qwen", "transformer", "attention", "fine-tune", "lora"],
}


def auto_tag(text: str) -> list[str]:
    lower = text.lower()
    return [tag for tag, keywords in TAG_KEYWORDS.items() if any(kw in lower for kw in keywords)]
