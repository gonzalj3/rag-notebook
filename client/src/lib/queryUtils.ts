/**
 * Extract a URL from a search query.
 *
 * Looks for full URLs (http://, https://) first, then falls back to
 * domain-like patterns (foo.com, bar.org). Returns the FIRST match.
 * Used to detect when a user is asking about a specific document
 * by reference, so we can pivot to URL-filtered retrieval.
 */
export function extractUrlFromQuery(query: string): string | null {
  // Full URL: http(s)://...
  const urlMatch = query.match(/https?:\/\/[^\s)"']+/i)
  if (urlMatch) {
    // Trim trailing punctuation
    return urlMatch[0].replace(/[.,;:!?]+$/, '')
  }

  // Domain-like: "sockpuppet.org", "blog.example.com"
  // Known TLD at end, at least one subdomain segment
  const COMMON_TLDS = 'com|org|net|io|dev|ai|co|edu|gov|info|blog|news|app|me|us|uk|ca|de|jp|fr'
  const domainRegex = new RegExp(
    `\\b([a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.(?:${COMMON_TLDS}))\\b`,
    'i',
  )
  const domainMatch = query.match(domainRegex)
  if (domainMatch) {
    return domainMatch[1]
  }

  return null
}

/**
 * Given a candidate URL/domain from a query and a list of known source URLs,
 * return the best-matching URL. Handles partial matches (e.g. "sockpuppet.org"
 * matches "https://sockpuppet.org/blog/...").
 */
export function matchKnownSourceUrl(
  candidate: string,
  knownUrls: string[],
): string | null {
  if (!candidate || knownUrls.length === 0) return null

  // Exact match first
  if (knownUrls.includes(candidate)) return candidate

  // Try to extract hostname from candidate if it's a full URL
  let candidateHost = candidate
  try {
    if (candidate.startsWith('http')) {
      candidateHost = new URL(candidate).hostname
    }
  } catch {
    // use as-is
  }
  candidateHost = candidateHost.replace(/^www\./, '').toLowerCase()

  // Find any known URL whose hostname contains the candidate
  for (const known of knownUrls) {
    try {
      const knownHost = new URL(known).hostname.replace(/^www\./, '').toLowerCase()
      if (knownHost === candidateHost || knownHost.includes(candidateHost)) {
        return known
      }
    } catch {
      // skip invalid URLs
    }
  }

  return null
}
