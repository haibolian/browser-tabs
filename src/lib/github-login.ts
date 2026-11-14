import { z } from 'zod'
import {
  CloudApi,
  requestServerAccess,
  saveCloudConnection,
  type CloudConnection,
} from './cloud-api'
import { CLOUD_SERVER_URL } from './cloud-server'

const pendingKey = 'blank:github-authorization'
const pendingSchema = z.object({
  baseUrl: z.literal(CLOUD_SERVER_URL),
  state: z.string().min(1),
  codeVerifier: z.string().min(1),
  returnUrl: z.string().url(),
})
type PendingLogin = z.infer<typeof pendingSchema>

function base64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

export async function createPkce() {
  const codeVerifier = base64Url(crypto.getRandomValues(new Uint8Array(32)))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))
  return { codeVerifier, codeChallenge: base64Url(new Uint8Array(digest)) }
}

export function githubReturnUrl() {
  return location.protocol === 'chrome-extension:'
    ? chrome.identity.getRedirectURL('github')
    : `${location.origin}${location.pathname}`
}

export function parseGitHubReturn(
  returnedUrl: string,
  pending: Pick<PendingLogin, 'state' | 'returnUrl'>,
) {
  const url = new URL(returnedUrl)
  const expectedUrl = new URL(pending.returnUrl)
  if (
    url.origin !== expectedUrl.origin ||
    url.pathname !== expectedUrl.pathname ||
    url.search !== expectedUrl.search
  )
    throw new Error('GitHub 登录返回地址不匹配，请重新登录')
  const params = new URLSearchParams(url.hash.slice(1))
  if (params.get('github_state') !== pending.state)
    throw new Error('GitHub 登录状态不匹配，请从当前页面重新登录')
  const error = params.get('github_error')
  if (error)
    throw new Error(error === 'access_denied' ? '已取消 GitHub 授权' : `GitHub 授权失败：${error}`)
  const code = params.get('github_code')
  if (!code) throw new Error('GitHub 未返回授权码，请重新登录')
  return code
}

async function finishLogin(returnedUrl: string, pending: PendingLogin): Promise<CloudConnection> {
  try {
    const code = parseGitHubReturn(returnedUrl, pending)
    const session = await new CloudApi().completeGitHubLogin(
      pending.state,
      code,
      pending.codeVerifier,
    )
    const connection: CloudConnection = { baseUrl: CLOUD_SERVER_URL, session }
    saveCloudConnection(connection)
    return connection
  } finally {
    sessionStorage.removeItem(pendingKey)
  }
}

export async function signInWithGitHub(): Promise<CloudConnection | null> {
  await requestServerAccess()
  const returnUrl = githubReturnUrl()
  const pkce = await createPkce()
  const authorization = await new CloudApi().startGitHubLogin(returnUrl, pkce.codeChallenge)
  const pending: PendingLogin = {
    baseUrl: CLOUD_SERVER_URL,
    returnUrl,
    state: authorization.state,
    codeVerifier: pkce.codeVerifier,
  }
  if (location.protocol === 'chrome-extension:') {
    const returnedUrl = await chrome.identity.launchWebAuthFlow({
      url: authorization.authorizationUrl,
      interactive: true,
    })
    if (!returnedUrl) throw new Error('GitHub 登录窗口未返回授权结果')
    return finishLogin(returnedUrl, pending)
  }
  sessionStorage.setItem(pendingKey, JSON.stringify(pending))
  location.assign(authorization.authorizationUrl)
  return null // The web page navigates away; this is not a successful session.
}

let redirectCompletion: Promise<CloudConnection> | undefined

export function completeGitHubRedirect() {
  // React StrictMode can mount the callback twice. Redeem the one-use code only once.
  redirectCompletion ??= (async () => {
    const returnedUrl = location.href
    history.replaceState(null, '', `${location.pathname}${location.search}`)
    const raw = sessionStorage.getItem(pendingKey)
    if (!raw) throw new Error('找不到此页面发起的 GitHub 登录请求，请返回桌面重新登录')
    const pending = pendingSchema.safeParse(JSON.parse(raw))
    if (!pending.success) {
      sessionStorage.removeItem(pendingKey)
      throw new Error('登录请求已失效，请重新使用 GitHub 登录')
    }
    return finishLogin(returnedUrl, pending.data)
  })()
  return redirectCompletion
}
