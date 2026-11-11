import type { SitePage } from './fetch-site-page'
export type SiteMetadata = { title: string | null; favicon: string | null; url: string }
export type SiteReadResult =
  { status: 'success'; metadata: SiteMetadata } | { status: 'permission'; message: string }

export function isSiteIconUrl(value: string) {
  return (
    /^https?:\/\//i.test(value) ||
    /^data:image\/(png|jpeg|webp|gif|avif|svg\+xml|x-icon|vnd\.microsoft\.icon)[;,]/i.test(value)
  )
}

export function parseSiteMetadata(page: SitePage): SiteMetadata {
  const document = new DOMParser().parseFromString(page.html, 'text/html')
  const title =
    document.querySelector('meta[property="og:site_name"]')?.getAttribute('content')?.trim() ||
    document.querySelector('title')?.textContent?.trim() ||
    document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() ||
    null
  const baseHref = document.querySelector('base[href]')?.getAttribute('href')
  const base = baseHref ? new URL(baseHref, page.url).href : page.url
  const candidates = [...document.querySelectorAll('link[rel]')]
    .filter((link) => /(^|\s)(icon|apple-touch-icon)(\s|$)/i.test(link.getAttribute('rel') ?? ''))
    .map((link) => ({ href: link.getAttribute('href'), size: link.getAttribute('sizes') ?? '' }))
    .filter((link) => link.href)
  candidates.sort(
    (a, b) =>
      (b.size === 'any' ? 64 : parseInt(b.size) || 16) -
      (a.size === 'any' ? 64 : parseInt(a.size) || 16),
  )
  const favicon =
    candidates.map((candidate) => new URL(candidate.href!, base).href).find(isSiteIconUrl) ?? null
  return { title, favicon, url: page.url }
}

export async function readSiteMetadata(
  url: string,
  requestAccess: boolean,
): Promise<SiteReadResult> {
  let page: SitePage
  if (location.protocol === 'chrome-extension:') {
    const parsed = new URL(url)
    const origins = [`${parsed.protocol}//${parsed.hostname}/*`]
    const allowed = requestAccess
      ? await chrome.permissions.request({ origins })
      : await chrome.permissions.contains({ origins })
    if (!allowed)
      return {
        status: 'permission',
        message:
          '首次读取需要允许访问这个站点。点击「允许读取」，或手动填写名称并使用文字图标、上传图片或系统预设。',
      }
    const response = await chrome.runtime.sendMessage({ type: 'blank:read-site', url })
    if (!response?.ok) throw new Error(response?.error ?? '扩展未返回网站信息')
    page = response.page
  } else {
    const response = await fetch(`/api/site-metadata?url=${encodeURIComponent(url)}`)
    const result = await response.json()
    if (!response.ok) throw new Error(result.error)
    page = result
  }
  return { status: 'success', metadata: parseSiteMetadata(page) }
}
