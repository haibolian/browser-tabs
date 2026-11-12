import { describe, expect, it } from 'vitest'
import { siteRequestError } from './site-request-error'

describe('网站读取错误', () => {
  it.each([
    ['EACCES', '网络连接被系统或运行环境拒绝'],
    ['ENOTFOUND', '无法解析网站域名'],
    ['UNABLE_TO_VERIFY_LEAF_SIGNATURE', '无法验证网站的证书链'],
    ['UND_ERR_CONNECT_TIMEOUT', '连接网站超时'],
  ])('保留 fetch 失败的底层原因 %s', (code, message) => {
    const cause = Object.assign(new Error('network error'), { code })
    expect(siteRequestError(new TypeError('fetch failed', { cause }))).toContain(message)
    expect(siteRequestError(new TypeError('fetch failed', { cause }))).toContain(code)
  })
  it('保留 HTTP 错误和浏览器未提供底层原因的错误', () => {
    expect(siteRequestError(new Error('网站返回 HTTP 403'))).toBe('网站返回 HTTP 403')
    expect(siteRequestError(new TypeError('Failed to fetch'))).toBe('Failed to fetch')
  })
})
