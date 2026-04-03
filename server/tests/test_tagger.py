from app.services.tagger import auto_tag


def test_rag_tags():
    tags = auto_tag("Building a RAG system with pgvector embeddings")
    assert "rag" in tags


def test_llm_tags():
    tags = auto_tag("Fine-tuning GPT with LoRA adapters")
    assert "llm" in tags


def test_multiple_tags():
    tags = auto_tag("Deploying a RAG agent pipeline with Docker")
    assert "rag" in tags
    assert "agents" in tags
    assert "infra" in tags


def test_no_tags():
    tags = auto_tag("A beautiful sunset over the ocean")
    assert tags == []


def test_case_insensitive():
    tags = auto_tag("VECTOR EMBEDDING RETRIEVAL")
    assert "rag" in tags
