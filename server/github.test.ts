import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from './app'
import { codeChallenge, createSecret } from './auth'
import { githubConfig, installGitHubFixture } from './testing/github-fixture'

describe('GitHub OAuth 边界', () => {
  let app: ReturnType<typeof createApp>
  let provider: ReturnType<typeof installGitHubFixture>
  beforeEach(() => {
    provider = installGitHubFixture()
    app = createApp({ databasePath: ':memory:', github: githubConfig })
  })
  afterEach(async () => {
    await app.close()
    vi.restoreAllMocks()
  })

  async function start(returnUrl = githubConfig.returnUrls[0]) {
    const codeVerifier = createSecret()
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/github/start',
      payload: {
        returnUrl,
        codeChallenge: codeChallenge(codeVerifier),
      },
    })
    expect(response.statusCode).toBe(200)
    return { ...response.json<{ state: string; authorizationUrl: string }>(), codeVerifier }
  }
  function complete(flow: { state: string; codeVerifier: string }, code = 'alice') {
    return app.inject({
      method: 'POST',
      url: '/api/v1/auth/github/complete',
      payload: { state: flow.state, codeVerifier: flow.codeVerifier, code },
    })
  }

  it('删除旧注册和密码登录接口，未配置 GitHub 时明确报错', async () => {
    for (const url of ['/api/v1/auth/register', '/api/v1/auth/login']) {
      expect((await app.inject({ method: 'POST', url, payload: {} })).statusCode).toBe(404)
    }
    const unconfigured = createApp({ databasePath: ':memory:' })
    try {
      const response = await unconfigured.inject({
        method: 'POST',
        url: '/api/v1/auth/github/start',
        payload: {},
      })
      expect(response.statusCode).toBe(503)
      expect(response.json().error).toContain('GITHUB_CLIENT_ID')
      expect(provider).not.toHaveBeenCalled()
    } finally {
      await unconfigured.close()
    }
  })

  it('使用随机 state、S256 和固定回调，仅请求公开身份', async () => {
    const first = await start()
    const second = await start()
    expect(first.state).not.toBe(second.state)
    const authorization = new URL(first.authorizationUrl)
    expect(authorization.origin).toBe('https://github.com')
    expect(authorization.pathname).toBe('/login/oauth/authorize')
    expect(authorization.searchParams.get('redirect_uri')).toBe(githubConfig.callbackUrl)
    expect(authorization.searchParams.get('code_challenge')).toBe(codeChallenge(first.codeVerifier))
    expect(authorization.searchParams.get('code_challenge_method')).toBe('S256')
    expect(authorization.searchParams.get('scope')).toBe('')
    expect(first.authorizationUrl).not.toContain(githubConfig.clientSecret)
    const callback = await app.inject({
      url: `/api/v1/auth/github/callback?state=${first.state}&code=alice`,
    })
    expect(callback.statusCode).toBe(302)
    expect(callback.headers['referrer-policy']).toBe('no-referrer')
    const returned = new URL(callback.headers.location!)
    expect(returned.origin).toBe('http://127.0.0.1:9900')
    expect(new URLSearchParams(returned.hash.slice(1)).get('github_state')).toBe(first.state)
    expect(provider).not.toHaveBeenCalled()
  })

  it('只允许精确配置的网页及扩展返回地址，拒绝开放重定向', async () => {
    await start(githubConfig.returnUrls[1])
    for (const returnUrl of [
      'https://attacker.example/',
      'http://127.0.0.1:9900/other',
      'http://127.0.0.1:9900/?next=https://attacker.example',
      'https://evil.chromiumapp.org/github',
    ]) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/github/start',
        payload: { returnUrl, codeChallenge: codeChallenge(createSecret()) },
      })
      expect(response.statusCode).toBe(400)
    }
  })

  it('不匹配的 PKCE 和伪造 state 不能换取会话，也不会消耗有效请求', async () => {
    const flow = await start()
    expect((await complete({ ...flow, codeVerifier: createSecret() })).statusCode).toBe(400)
    expect((await complete({ ...flow, state: 'forged' })).statusCode).toBe(400)
    expect(
      (await app.inject({ url: '/api/v1/auth/github/callback?state=forged&code=alice' }))
        .statusCode,
    ).toBe(400)
    expect(provider).not.toHaveBeenCalled()
    expect((await complete(flow)).statusCode).toBe(200)
  })

  it('授权请求过期后不能回调或创建会话', async () => {
    const flow = await start()
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 601_000)
    expect((await complete(flow)).statusCode).toBe(400)
    expect(
      (await app.inject({ url: `/api/v1/auth/github/callback?state=${flow.state}&code=alice` }))
        .statusCode,
    ).toBe(400)
    expect(provider).not.toHaveBeenCalled()
  })

  it('并发兑换同一请求只能成功一次', async () => {
    const flow = await start()
    const responses = await Promise.all([complete(flow), complete(flow)])
    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 400])
    expect(provider).toHaveBeenCalledTimes(2)
  })

  it('GitHub 拒绝、断网和无效用户资料均失败，不生成本地会话', async () => {
    const rejected = await start()
    const denied = await complete(rejected, 'rejected')
    expect(denied.statusCode).toBe(400)
    expect(denied.json()).not.toHaveProperty('token')
    const offline = await start()
    provider.mockRejectedValueOnce(new Error('network unavailable'))
    expect((await complete(offline)).statusCode).toBe(502)
    const invalid = await start()
    provider.mockResolvedValueOnce(Response.json({ access_token: 'invalid-profile-token' }))
    provider.mockResolvedValueOnce(Response.json({ login: 'alice' }))
    const result = await complete(invalid)
    expect(result.statusCode).toBe(502)
    expect(result.json()).not.toHaveProperty('token')
  })

  it('用户取消授权时只返回错误状态，不生成会话', async () => {
    const flow = await start()
    const response = await app.inject({
      url: `/api/v1/auth/github/callback?state=${flow.state}&error=access_denied`,
    })
    expect(response.statusCode).toBe(302)
    expect(new URL(response.headers.location!).hash).toContain('github_error=access_denied')
    expect(provider).not.toHaveBeenCalled()
  })
})
