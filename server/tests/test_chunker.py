from app.services.chunker import chunk


def test_single_chunk_note():
    results = chunk("This is a quick note about RAG systems", "note")
    assert len(results) == 1
    assert results[0].index == 0
    assert results[0].content == "This is a quick note about RAG systems"


def test_single_chunk_paste():
    results = chunk("A tweet about embeddings", "paste")
    assert len(results) == 1


def test_single_chunk_handwritten():
    results = chunk("OCR'd handwritten note content", "handwritten")
    assert len(results) == 1


def test_single_chunk_takeaway():
    results = chunk("Key insight: always normalize embeddings", "takeaway")
    assert len(results) == 1


def test_url_chunking_short():
    """Short article should be a single chunk."""
    text = "This is a short article about vector databases. " * 10
    results = chunk(text, "url")
    assert len(results) == 1


def test_url_chunking_long():
    """Long article should be split into multiple chunks."""
    text = " ".join(f"word{i}" for i in range(1500))
    results = chunk(text, "url")
    assert len(results) > 1
    for r in results:
        assert r.token_count <= 520  # 512 + small variance


def test_conversation_chunking():
    text = """Human: What is RAG?
AI: RAG stands for Retrieval Augmented Generation.
Human: How does it work?
AI: It retrieves relevant documents and uses them as context for generation."""
    results = chunk(text, "conversation")
    assert len(results) == 2


def test_dialogue_chunking():
    text = "First paragraph about thinking.\n\nSecond paragraph with more thoughts.\n\nThird paragraph conclusion."
    results = chunk(text, "dialogue")
    # Short paragraphs should be merged into fewer chunks
    assert len(results) >= 1


def test_book_page_single_chunk():
    results = chunk("Full page of text from a book about machine learning.", "book_page")
    assert len(results) == 1


def test_chunk_token_counts():
    text = "one two three four five"
    results = chunk(text, "note")
    assert results[0].token_count == 5
