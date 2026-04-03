import re
from urllib.parse import urlparse

import httpx


def _detect_platform(url: str) -> str:
    host = urlparse(url).netloc.lower()
    if "claude" in host:
        return "claude"
    if "chatgpt" in host or "openai" in host:
        return "chatgpt"
    return "unknown"


def _parse_claude_html(html: str) -> list[dict]:
    """Parse Claude share page HTML into conversation turns."""
    messages = []
    # Claude share pages render turns in data attributes or structured divs
    # Look for human/assistant patterns in the rendered text
    human_pattern = re.compile(r'<div[^>]*class="[^"]*human[^"]*"[^>]*>(.*?)</div>', re.DOTALL | re.IGNORECASE)
    assistant_pattern = re.compile(r'<div[^>]*class="[^"]*assistant[^"]*"[^>]*>(.*?)</div>', re.DOTALL | re.IGNORECASE)

    # Fallback: split by role markers in the text content
    text = re.sub(r'<[^>]+>', '\n', html)
    text = re.sub(r'\n{3,}', '\n\n', text).strip()

    # Try to find alternating human/assistant blocks
    blocks = re.split(r'\n(?=(?:Human|User|Assistant|Claude):)', text)
    for block in blocks:
        block = block.strip()
        if not block:
            continue
        if block.startswith(("Human:", "User:")):
            content = re.sub(r'^(?:Human|User):\s*', '', block).strip()
            if content:
                messages.append({"role": "human", "content": content})
        elif block.startswith(("Assistant:", "Claude:")):
            content = re.sub(r'^(?:Assistant|Claude):\s*', '', block).strip()
            if content:
                messages.append({"role": "assistant", "content": content})

    return messages


def _parse_chatgpt_html(html: str) -> list[dict]:
    """Parse ChatGPT share page HTML into conversation turns."""
    messages = []
    text = re.sub(r'<[^>]+>', '\n', html)
    text = re.sub(r'\n{3,}', '\n\n', text).strip()

    blocks = re.split(r'\n(?=(?:You|ChatGPT):)', text)
    for block in blocks:
        block = block.strip()
        if not block:
            continue
        if block.startswith("You:"):
            content = block[4:].strip()
            if content:
                messages.append({"role": "human", "content": content})
        elif block.startswith("ChatGPT:"):
            content = block[8:].strip()
            if content:
                messages.append({"role": "assistant", "content": content})

    return messages


async def parse_conversation(share_url: str) -> dict:
    """Fetch a conversation share link and parse into structured turns."""
    platform = _detect_platform(share_url)

    async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
        response = await client.get(share_url, headers={"User-Agent": "RAGNotebook/0.1"})
        response.raise_for_status()
        html = response.text

    if platform == "claude":
        messages = _parse_claude_html(html)
    elif platform == "chatgpt":
        messages = _parse_chatgpt_html(html)
    else:
        # Generic fallback
        messages = _parse_claude_html(html)

    # Try to extract title from <title> tag
    title_match = re.search(r'<title>(.*?)</title>', html, re.IGNORECASE)
    title = title_match.group(1).strip() if title_match else None

    return {
        "platform": platform,
        "title": title,
        "message_count": len(messages),
        "messages": messages,
    }
