import { createHash, randomBytes } from 'node:crypto'

export function createSecret() {
  return randomBytes(32).toString('base64url')
}

export function codeChallenge(verifier: string) {
  return createHash('sha256').update(verifier).digest('base64url')
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function createSession(sessionDays: number) {
  const token = createSecret()
  return { token, tokenHash: hashToken(token), expiresAt: Date.now() + sessionDays * 86_400_000 }
}
