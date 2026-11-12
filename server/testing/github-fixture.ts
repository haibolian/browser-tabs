import { expect, vi } from 'vitest'
import { codeChallenge, createSecret } from '../auth'
import type { createApp } from '../app'
import type { GitHubConfig } from '../github'
import type { CloudSession } from '../../src/lib/cloud-contract'

export const githubConfig: GitHubConfig = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  callbackUrl: 'http://127.0.0.1:3001/api/v1/auth/github/callback',
  returnUrls: [
    'http://127.0.0.1:9900/',
    'https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/github',
  ],
}

// Only the external provider is stubbed in tests. App routes, SQLite, crypto and HTTP are real.
export function installGitHubFixture() {
  const originalFetch = globalThis.fetch
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    if (String(input) === 'https://github.com/login/oauth/access_token') {
      const body = new URLSearchParams(init?.body as URLSearchParams)
      expect(body.get('client_id')).toBe(githubConfig.clientId)
      expect(body.get('client_secret')).toBe(githubConfig.clientSecret)
      expect(body.get('redirect_uri')).toBe(githubConfig.callbackUrl)
      expect(body.get('code_verifier')).toMatch(/^[A-Za-z0-9_-]{43,128}$/)
      if (body.get('code') === 'rejected') return Response.json({ error: 'bad_verification_code' })
      return Response.json({ access_token: `provider-token-${body.get('code')}` })
    }
    if (String(input) === 'https://api.github.com/user') {
      const token = new Headers(init?.headers).get('authorization')!
      const login = token.replace('Bearer provider-token-', '')
      return Response.json({ id: login === 'bob' ? 202 : 101, login })
    }
    return originalFetch(input, init)
  })
}

export async function githubSignIn(app: ReturnType<typeof createApp>, login = 'alice') {
  const codeVerifier = createSecret()
  const started = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/github/start',
    payload: {
      returnUrl: githubConfig.returnUrls[0],
      codeChallenge: codeChallenge(codeVerifier),
    },
  })
  expect(started.statusCode).toBe(200)
  const { state } = started.json()
  const callback = await app.inject({
    url: `/api/v1/auth/github/callback?state=${state}&code=${login}`,
  })
  expect(callback.statusCode).toBe(302)
  const result = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/github/complete',
    payload: { state, code: login, codeVerifier },
  })
  expect(result.statusCode).toBe(200)
  const session = result.json<CloudSession>()
  return { session, headers: { authorization: `Bearer ${session.token}` } }
}
