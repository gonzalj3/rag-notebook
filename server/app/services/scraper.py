from urllib.parse import urlparse

import httpx
import trafilatura


async def scrape_url(url: str) -> dict:
    """Fetch a URL and extract clean article text using trafilatura."""
    async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
        response = await client.get(url, headers={"User-Agent": "RAGNotebook/0.1"})
        response.raise_for_status()
        html = response.text

    extracted = trafilatura.extract(html, include_comments=False, include_tables=True)
    if not extracted:
        raise ValueError(f"Could not extract text from {url}")

    metadata = trafilatura.extract(html, output_format="json", include_comments=False)
    title = None
    if metadata:
        import json
        try:
            meta = json.loads(metadata)
            title = meta.get("title")
        except (json.JSONDecodeError, TypeError):
            pass

    domain = urlparse(url).netloc.removeprefix("www.")

    return {
        "text": extracted,
        "title": title,
        "domain": domain,
    }
