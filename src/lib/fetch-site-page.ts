export type SitePage = { html: string; url: string }

// Shared by the extension worker and Vite's local metadata endpoint.
// Requests go directly to the entered site and do not include account cookies.
export async function fetchSitePage(input: string): Promise<SitePage> {
  const url = new URL(input)
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('只支持 http 或 https 网站')
  const response = await fetch(url, {
    credentials: 'omit',
    headers: { Accept: 'text/html,application/xhtml+xml' },
  })
  if (!response.ok) throw new Error(`网站返回 HTTP ${response.status}`)
  const contentType = response.headers.get('content-type')
  if (contentType && !/(text\/html|application\/xhtml\+xml)/i.test(contentType))
    throw new Error('该地址没有返回网页内容')
  return { html: await response.text(), url: response.url }
}
