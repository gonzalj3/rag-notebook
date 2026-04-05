import { describe, it, expect } from 'vitest'
import { extractUrlFromQuery, matchKnownSourceUrl } from '../queryUtils'

describe('extractUrlFromQuery', () => {
  it('extracts full https URL from query', () => {
    const q = 'what is in https://sockpuppet.org/blog/post about security'
    expect(extractUrlFromQuery(q)).toBe('https://sockpuppet.org/blog/post')
  })

  it('extracts http URL', () => {
    expect(extractUrlFromQuery('check http://example.com/page')).toBe('http://example.com/page')
  })

  it('strips trailing punctuation from URL', () => {
    expect(extractUrlFromQuery('see https://example.com/page.')).toBe('https://example.com/page')
    expect(extractUrlFromQuery('at https://example.com?')).toBe('https://example.com')
  })

  it('extracts bare domain name', () => {
    expect(extractUrlFromQuery('what is the main thesis for the sockpuppet.org article?'))
      .toBe('sockpuppet.org')
  })

  it('extracts subdomain.domain.tld', () => {
    expect(extractUrlFromQuery('the blog.example.com post')).toBe('blog.example.com')
  })

  it('returns null when no URL present', () => {
    expect(extractUrlFromQuery('what did the author say about chunking')).toBeNull()
    expect(extractUrlFromQuery('summarize the article')).toBeNull()
  })

  it('does not match arbitrary sentences with periods', () => {
    expect(extractUrlFromQuery('Hello. World.')).toBeNull()
    expect(extractUrlFromQuery('yes. it works.')).toBeNull()
  })

  it('prefers full URL over bare domain when both present', () => {
    const q = 'see https://foo.com/x but example.org works too'
    expect(extractUrlFromQuery(q)).toBe('https://foo.com/x')
  })
})

describe('matchKnownSourceUrl', () => {
  const knownUrls = [
    'https://sockpuppet.org/blog/2026/03/30/vulnerability-research-is-cooked/',
    'https://simonwillison.net/2026/Apr/2/lennys-podcast/',
    'https://magazine.sebastianraschka.com/p/components-of-a-coding-agent',
  ]

  it('matches bare domain to full known URL', () => {
    expect(matchKnownSourceUrl('sockpuppet.org', knownUrls))
      .toBe('https://sockpuppet.org/blog/2026/03/30/vulnerability-research-is-cooked/')
  })

  it('matches subdomain to known URL', () => {
    expect(matchKnownSourceUrl('simonwillison.net', knownUrls))
      .toBe('https://simonwillison.net/2026/Apr/2/lennys-podcast/')
  })

  it('matches full URL exactly', () => {
    expect(matchKnownSourceUrl(knownUrls[0], knownUrls)).toBe(knownUrls[0])
  })

  it('returns null when no match', () => {
    expect(matchKnownSourceUrl('unknown.com', knownUrls)).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(matchKnownSourceUrl('', knownUrls)).toBeNull()
    expect(matchKnownSourceUrl('foo.com', [])).toBeNull()
  })

  it('handles www. prefix', () => {
    expect(matchKnownSourceUrl('www.sockpuppet.org', knownUrls))
      .toBe('https://sockpuppet.org/blog/2026/03/30/vulnerability-research-is-cooked/')
  })

  it('is case insensitive', () => {
    expect(matchKnownSourceUrl('SOCKPUPPET.ORG', knownUrls))
      .toBe('https://sockpuppet.org/blog/2026/03/30/vulnerability-research-is-cooked/')
  })
})
