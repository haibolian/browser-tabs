// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { DesktopMenu } from './desktop-menu'
import { SettingsDialog } from '@/components/settings-dialog'
import { FolderEditor } from './folder-editor'
import { createWorkspace } from '@/lib/workspace'

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(cleanup)

function DesktopFlow() {
  const [workspace, update] = useState(createWorkspace)
  const [settings, setSettings] = useState(false)
  const [group, setGroup] = useState(false)
  return (
    <>
      <DesktopMenu
        onAdd={() => {}}
        onNewFolder={() => setGroup(true)}
        onSettings={() => setSettings(true)}
      >
        <div className="desktop">
          <div tabIndex={0} data-testid="grid">
            桌面空白
          </div>
          <input aria-label="搜索内容" />
        </div>
      </DesktopMenu>
      <SettingsDialog
        open={settings}
        onOpenChange={setSettings}
        workspace={workspace}
        update={update}
        onImport={() => {}}
        imageUrl={null}
        resolvedTheme="light"
        onArrangeDesktop={() => {}}
        cloudConnection={null}
        connectionError={null}
        cloudUpload={{
          state: { phase: 'idle', lastUpload: null, error: null },
          retry: () => {},
          uploadNow: async () => {},
        }}
      />
      {group && <FolderEditor item={null} update={update} onClose={() => setGroup(false)} />}
    </>
  )
}

function openMenu() {
  const grid = screen.getByTestId('grid')
  grid.focus()
  fireEvent.contextMenu(grid, { clientX: 640, clientY: 480 })
}

async function finishFocusCleanup() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30))
  })
}

describe('桌面右键的完整操作流程', () => {
  it('网格有焦点时，打开设置并等待菜单关闭后，面板持续显示且持有焦点；重复三次', async () => {
    render(<DesktopFlow />)
    for (let index = 0; index < 3; index++) {
      openMenu()
      fireEvent.click(screen.getByRole('menuitem', { name: '设置' }))
      await screen.findByRole('heading', { name: '偏好设置' })
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
      await finishFocusCleanup()
      const panel = screen.getByRole('heading', { name: '偏好设置' }).closest('.settings-panel')!
      expect(panel.contains(document.activeElement)).toBe(true)
      fireEvent.click(screen.getByRole('button', { name: '关闭弹窗' }))
      await waitFor(() => expect(screen.queryByRole('heading', { name: '偏好设置' })).toBeNull())
      await finishFocusCleanup()
    }
  })

  it('菜单到新建分组的交接不把焦点抢回桌面', async () => {
    render(<DesktopFlow />)
    openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: '新建分组' }))
    const input = await screen.findByRole('textbox', { name: '分组名称' })
    await finishFocusCleanup()
    expect(document.activeElement).toBe(input)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.queryByText('分组颜色')).toBeNull()
  })

  it('按 Escape 取消菜单后恢复网格焦点，不打开面板', async () => {
    render(<DesktopFlow />)
    openMenu()
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    await finishFocusCleanup()
    expect(document.activeElement).toBe(screen.getByTestId('grid'))
    expect(screen.queryByRole('heading', { name: '偏好设置' })).toBeNull()
  })

  it('输入框右键不触发桌面菜单', () => {
    render(<DesktopFlow />)
    fireEvent.contextMenu(screen.getByRole('textbox', { name: '搜索内容' }))
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
