// @vitest-environment jsdom
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DesktopGrid } from './desktop-grid'
import { ShortcutDnd } from './shortcut-dnd'
import { createWorkspace, findShortcut, type Workspace } from '@/lib/workspace'

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => ({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 360,
    bottom: 200,
    width: 360,
    height: 200,
    toJSON() {},
  }))
  const original = window.getComputedStyle
  vi.spyOn(window, 'getComputedStyle').mockImplementation((node) => {
    const style = original(node)
    if (node.classList.contains('slot-viewport')) {
      Object.defineProperties(
        style,
        Object.fromEntries(
          ['paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom'].map((key) => [
            key,
            { value: '0px', configurable: true },
          ]),
        ),
      )
    }
    return style
  })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function Grid() {
  const [workspace, update] = useState<Workspace>(() => {
    const state = createWorkspace()
    const base = findShortcut(state.items, 'github')!
    return {
      ...state,
      items: Array.from({ length: 80 }, (_, i) => ({
        ...base,
        id: `site-${i}`,
        title: `网站${i}`,
      })),
    }
  })
  return (
    <ShortcutDnd workspace={workspace} update={update}>
      <DesktopGrid
        items={workspace.items}
        workspace={workspace}
        onAdd={() => {}}
        onPositionsChange={() => {}}
        onIconSizeChange={() => {}}
        onOpenFolder={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onMove={() => {}}
        onUngroup={() => {}}
      />
    </ShortcutDnd>
  )
}

it('80 个网站只挂载当前页，翻页后卸载前一页并恢复当前页链接', async () => {
  render(<Grid />)
  await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(8))
  expect(screen.queryByRole('link', { name: '打开网站：网站8' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '下一页' }))
  expect(screen.queryByRole('link', { name: '打开网站：网站0' })).toBeNull()
  expect(screen.getByRole('link', { name: '打开网站：网站8' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '上一页' }))
  expect(screen.getByRole('link', { name: '打开网站：网站0' })).toBeTruthy()
})

it('键盘拖拽跨页时保留来源，取消后移除隐藏来源', async () => {
  render(<Grid />)
  const source = screen.getByRole('link', { name: '打开网站：网站0' })
  source.focus()
  fireEvent.keyDown(source, { key: ' ', code: 'Space' })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  fireEvent.keyDown(window, { key: 'PageDown', code: 'PageDown' })
  await waitFor(() =>
    expect(document.querySelector('.desktop-grid')?.getAttribute('data-page')).toBe('2'),
  )
  expect(document.querySelector('[data-grid-id="site-0"]')).not.toBeNull()
  fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
  await waitFor(() => expect(document.querySelector('[data-grid-id="site-0"]')).toBeNull())
})
