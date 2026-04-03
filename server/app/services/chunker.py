from dataclasses import dataclass


@dataclass
class ChunkResult:
    content: str
    index: int
    token_count: int


def _count_tokens(text: str) -> int:
    return len(text.split())


def _recursive_split(text: str, max_tokens: int = 512, overlap_ratio: float = 0.1) -> list[str]:
    """Split text recursively by paragraphs, then sentences, then words."""
    words = text.split()
    if len(words) <= max_tokens:
        return [text]

    overlap = int(max_tokens * overlap_ratio)
    chunks = []

    # Try splitting by paragraphs first
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    if len(paragraphs) > 1:
        current = []
        current_len = 0
        for para in paragraphs:
            para_len = _count_tokens(para)
            if current_len + para_len > max_tokens and current:
                chunks.append("\n\n".join(current))
                # Keep overlap from the end of current
                overlap_text = " ".join("\n\n".join(current).split()[-overlap:])
                current = [overlap_text, para] if overlap > 0 else [para]
                current_len = _count_tokens(" ".join(current))
            else:
                current.append(para)
                current_len += para_len
        if current:
            chunks.append("\n\n".join(current))
        return chunks

    # Fall back to word-level splitting
    start = 0
    while start < len(words):
        end = min(start + max_tokens, len(words))
        chunks.append(" ".join(words[start:end]))
        start = end - overlap if end < len(words) else end

    return chunks


def _split_exchange_pairs(text: str) -> list[str]:
    """Split conversation into human-AI exchange pairs."""
    lines = text.split("\n")
    pairs = []
    current_pair = []

    for line in lines:
        is_human_turn = line.startswith("Human:") or line.startswith("User:")
        if is_human_turn and current_pair:
            pairs.append("\n".join(current_pair))
            current_pair = []
        current_pair.append(line)

    if current_pair:
        pairs.append("\n".join(current_pair))

    return pairs if pairs else [text]


def _split_paragraphs(text: str) -> list[str]:
    """Split by paragraphs, merging small ones."""
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    if len(paragraphs) <= 1:
        return [text]

    merged = []
    current = []
    current_len = 0
    min_tokens = 50

    for para in paragraphs:
        para_len = _count_tokens(para)
        if current_len + para_len > 512 and current:
            merged.append("\n\n".join(current))
            current = [para]
            current_len = para_len
        else:
            current.append(para)
            current_len += para_len

    if current:
        chunk = "\n\n".join(current)
        # Merge tiny trailing chunk with previous
        if _count_tokens(chunk) < min_tokens and merged:
            merged[-1] = merged[-1] + "\n\n" + chunk
        else:
            merged.append(chunk)

    return merged


def chunk(content: str, source_type: str) -> list[ChunkResult]:
    """Route content to the appropriate chunking strategy based on source type."""
    if source_type in ("paste", "note", "handwritten", "takeaway"):
        pieces = [content]
    elif source_type == "url":
        pieces = _recursive_split(content, max_tokens=512, overlap_ratio=0.1)
    elif source_type == "book_page":
        pieces = [content]
    elif source_type == "conversation":
        pieces = _split_exchange_pairs(content)
    elif source_type == "dialogue":
        pieces = _split_paragraphs(content)
    else:
        pieces = _recursive_split(content)

    return [
        ChunkResult(content=piece, index=i, token_count=_count_tokens(piece))
        for i, piece in enumerate(pieces)
    ]
