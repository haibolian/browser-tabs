import { describe, expect, it } from 'vitest'
import { createPkce, parseGitHubReturn } from './github-login'

describe('GitHub 登录返回校验', () => {
  const pending = { state: 'expected-state', returnUrl: 'http://127.0.0.1:9900/' }
  it('浏览器生成符合 S256 的随机证明', async () => {
    const first = await createPkce()
    const second = await createPkce()
    expect(first.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(first.codeVerifier).not.toBe(second.codeVerifier)
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(first.codeVerifier),
    )
    expect(first.codeChallenge).toBe(Buffer.from(digest).toString('base64url'))
  })
  it('只接受本页发起的返回结果，包括扩展回调', () => {
    expect(
      parseGitHubReturn(
        `${pending.returnUrl}#github_state=expected-state&github_code=code`,
        pending,
      ),
    ).toBe('code')
    const extension = { ...pending, returnUrl: 'https://extension-id.chromiumapp.org/github' }
    expect(
      parseGitHubReturn(
        `${extension.returnUrl}#github_state=expected-state&github_code=code`,
        extension,
      ),
    ).toBe('code')
    expect(() =>
      parseGitHubReturn(`${pending.returnUrl}#github_state=wrong&github_code=code`, pending),
    ).toThrow('状态不匹配')
    expect(() =>
      parseGitHubReturn(
        'https://attacker.example/#github_state=expected-state&github_code=code',
        pending,
      ),
    ).toThrow('地址不匹配')
    expect(() =>
      parseGitHubReturn(`${pending.returnUrl}#github_state=expected-state`, pending),
    ).toThrow('未返回授权码')
    expect(() =>
      parseGitHubReturn(
        `${pending.returnUrl}#github_state=expected-state&github_error=access_denied`,
        pending,
      ),
    ).toThrow('已取消 GitHub 授权')
  })
})
