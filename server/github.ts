import { z } from 'zod'
import type { GitHubIdentity } from '../src/lib/cloud-contract'
import { ApiError } from './errors'

export type GitHubConfig = {
  clientId: string
  clientSecret: string
  callbackUrl: string
  returnUrls: string[]
}

export class GitHubOAuth {
  private config: GitHubConfig
  constructor(config: GitHubConfig) {
    this.config = config
  }

  authorizationUrl(state: string, codeChallenge: string) {
    const url = new URL('https://github.com/login/oauth/authorize')
    url.search = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.callbackUrl,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      scope: '',
    }).toString()
    return url.href
  }

  async identify(code: string, codeVerifier: string): Promise<GitHubIdentity> {
    let tokenResponse: Response
    try {
      tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          redirect_uri: this.config.callbackUrl,
          code,
          code_verifier: codeVerifier,
        }),
        redirect: 'error',
      })
    } catch (error) {
      throw new ApiError(502, `连接 GitHub 授权服务失败：${(error as Error).message}`)
    }
    if (!tokenResponse.ok)
      throw new ApiError(502, `GitHub 授权服务返回 HTTP ${tokenResponse.status}`)
    const result: unknown = await tokenResponse.json()
    const denied = z.object({ error: z.string() }).safeParse(result)
    if (denied.success)
      throw new ApiError(400, `GitHub 授权失败（${denied.data.error}），请重新登录`)
    const token = z.object({ access_token: z.string().min(1) }).safeParse(result)
    if (!token.success) throw new ApiError(502, 'GitHub 授权服务未返回有效令牌')

    let profileResponse: Response
    try {
      profileResponse = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token.data.access_token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'blank-new-tab',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        redirect: 'error',
      })
    } catch (error) {
      throw new ApiError(502, `读取 GitHub 身份失败：${(error as Error).message}`)
    }
    if (!profileResponse.ok)
      throw new ApiError(502, `GitHub 用户接口返回 HTTP ${profileResponse.status}`)
    const profile = z
      .object({ id: z.number().int().positive(), login: z.string().min(1) })
      .safeParse(await profileResponse.json())
    if (!profile.success) throw new ApiError(502, 'GitHub 返回的用户资料无效')
    // The provider token is used only for this identity lookup, never persisted or sent to the client.
    return { githubId: String(profile.data.id), login: profile.data.login }
  }
}
