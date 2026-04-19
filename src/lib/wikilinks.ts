// Parse [[wiki-links]] from markdown content
export function extractWikiLinks(content: string): string[] {
  const matches = content.matchAll(/\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)
  return [...matches].map((m) => m[1].trim())
}

// Replace [[wiki-link]] with resolved link or mark as broken
export function resolveWikiLinks(
  content: string,
  noteTitles: Map<string, string>
): string {
  return content.replace(
    /\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g,
    (_, title, alias) => {
      const id = noteTitles.get(title.trim())
      const label = alias ?? title
      if (id) return `[${label}](note://${id})`
      return `[${label}](note://broken)`
    }
  )
}

// Strip frontmatter and return body + parsed metadata
export function parseFrontmatter(raw: string): {
  body: string
  data: Record<string, unknown>
} {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return { body: raw, data: {} }
  const data: Record<string, unknown> = {}
  for (const line of match[1].split('\n')) {
    const [key, ...rest] = line.split(':')
    if (key && rest.length) data[key.trim()] = rest.join(':').trim()
  }
  return { body: match[2], data }
}
