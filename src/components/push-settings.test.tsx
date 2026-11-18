// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CloudApi, type CloudConnection } from '@/lib/cloud-api'
import { CLOUD_SERVER_URL } from '@/lib/cloud-server'
import { pushMcpConfig } from '@/lib/push-config'
import { PushSettings } from './push-settings'

const connection: CloudConnection = {
  baseUrl: CLOUD_SERVER_URL,
  session: {
    token: 'session',
    expiresAt: Date.now() + 60000,
    user: { id: 'owner', githubId: '101', login: 'alice' },
  },
}
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it('生成后可一次复制 MCP 地址和令牌，关闭后仅保留脱敏信息', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  vi.spyOn(CloudApi.prototype, 'listPushTokens').mockResolvedValue([])
  const created = {
    id: crypto.randomUUID(),
    name: 'Codex',
    suffix: 'secret',
    createdAt: 100,
    lastUsedAt: null,
    token: 'blank_push_test-secret',
  }
  vi.spyOn(CloudApi.prototype, 'createPushToken').mockResolvedValue(created)
  render(<PushSettings connection={connection} />)
  const generate = screen.getByRole('button', { name: '生成令牌' })
  await waitFor(() => expect(generate.hasAttribute('disabled')).toBe(false))
  fireEvent.click(generate)
  await screen.findByRole('dialog', { name: '推送令牌' })
  fireEvent.click(screen.getByRole('button', { name: '复制 MCP 配置' }))
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(pushMcpConfig(created.token)))
  fireEvent.click(screen.getByRole('button', { name: '关闭弹窗' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.queryByDisplayValue(created.token)).toBeNull()
  expect(screen.getByText('…secret')).toBeTruthy()
})
