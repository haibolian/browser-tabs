// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { ShortcutEditor } from './shortcut-editor'
import { createWorkspace, findShortcut, type Workspace } from '@/lib/workspace'

vi.mock('@/hooks/use-site-details', () => ({
  useSiteDetails: () => ({ status: 'idle', message: '', read: async () => {} }),
}))
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
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
})
afterEach(cleanup)

it('新建文字图标分别选择背景色和文本颜色，编辑时恢复选择', () => {
  let workspace = createWorkspace()
  const close = vi.fn()
  const update = (change: (state: Workspace) => Workspace) => {
    workspace = change(workspace)
  }
  const view = render(
    <ShortcutEditor
      item={null}
      initialParentId={null}
      workspace={workspace}
      update={update}
      onClose={close}
    />,
  )
  fireEvent.change(screen.getByLabelText('网站地址'), { target: { value: 'https://example.com' } })
  fireEvent.change(screen.getByLabelText('网站名称'), { target: { value: '测试文字' } })
  fireEvent.change(screen.getByLabelText('图标文字'), { target: { value: '文' } })
  fireEvent.click(screen.getByRole('button', { name: '文本颜色 #fbbe23' }))
  fireEvent.click(screen.getByRole('button', { name: '图标背景色 #4b3c36' }))
  fireEvent.click(screen.getByRole('button', { name: '添加网站' }))
  expect(close).toHaveBeenCalledOnce()
  const item = workspace.items.at(-1)!
  expect(item).toMatchObject({
    iconText: '文',
    iconTextColor: '#fbbe23',
    iconBackground: '#4b3c36',
  })
  if (item.kind !== 'shortcut') throw new Error('Expected shortcut')
  view.rerender(
    <ShortcutEditor
      key={item.id}
      item={item}
      initialParentId={null}
      workspace={workspace}
      update={update}
      onClose={close}
    />,
  )
  expect(
    screen.getByRole('button', { name: '文本颜色 #fbbe23' }).getAttribute('aria-pressed'),
  ).toBe('true')
  expect(
    screen.getByRole('button', { name: '图标背景色 #4b3c36' }).getAttribute('aria-pressed'),
  ).toBe('true')
})

it('新增精选图标搜索后立即渲染 SVG 并保存，选择器每页只挂载 48 个选项', () => {
  let workspace = createWorkspace()
  const item = findShortcut(workspace.items, 'github')!
  render(
    <ShortcutEditor
      item={item}
      initialParentId={null}
      workspace={workspace}
      update={(change) => {
        workspace = change(workspace)
      }}
      onClose={() => {}}
    />,
  )
  expect(screen.getAllByRole('button', { name: /^选择图标 / })).toHaveLength(48)
  fireEvent.change(screen.getByRole('searchbox', { name: '搜索系统预设图标' }), {
    target: { value: '机器人' },
  })
  const option = screen.getByRole('button', { name: '选择图标 机器人' })
  expect(option.querySelector('svg.lucide-bot')).not.toBeNull()
  fireEvent.click(option)
  fireEvent.click(screen.getByRole('button', { name: '保存修改' }))
  expect(findShortcut(workspace.items, item.id)?.icon).toBe('bot')
})

it('放置位置使用自定义选择器，键盘选择分组后保存，Escape 仅关闭下拉层', async () => {
  let workspace = createWorkspace()
  const item = findShortcut(workspace.items, 'github')!
  const close = vi.fn()
  render(
    <ShortcutEditor
      item={item}
      initialParentId={null}
      workspace={workspace}
      update={(change) => {
        workspace = change(workspace)
      }}
      onClose={close}
    />,
  )
  const trigger = screen.getByRole('combobox', { name: '放置位置' })
  expect(trigger.tagName).toBe('BUTTON')
  expect(trigger.textContent).toContain('桌面')
  trigger.focus()
  fireEvent.keyDown(trigger, { key: 'ArrowDown' })
  const listbox = await screen.findByRole('listbox')
  expect(listbox.getAttribute('data-slot')).toBe('select-content')
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole('option', { name: '桌面' })),
  )
  fireEvent.keyDown(document.activeElement!, { key: 'End' })
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole('option', { name: '开发工具' })),
  )
  fireEvent.keyDown(document.activeElement!, { key: 'Enter' })
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
  expect(trigger.textContent).toContain('开发工具')
  expect(close).not.toHaveBeenCalled()
  await waitFor(() => expect(document.activeElement).toBe(trigger))
  fireEvent.keyDown(trigger, { key: ' ' })
  await screen.findByRole('listbox')
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
  expect(screen.getByRole('dialog')).toBeTruthy()
  expect(close).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '保存修改' }))
  expect(workspace.items.some((entry) => entry.id === item.id)).toBe(false)
  const folder = workspace.items.find((entry) => entry.id === 'tools')!
  expect(folder.kind === 'folder' && folder.items.some((entry) => entry.id === item.id)).toBe(true)
})

it('编辑分组内的网站可选择桌面，桌面选项与同名 ID 的分组互不冲突', async () => {
  const state = createWorkspace()
  let workspace = {
    ...state,
    items: state.items.map((entry) => (entry.id === 'tools' ? { ...entry, id: 'desktop' } : entry)),
  }
  const item = findShortcut(workspace.items, 'mdn')!
  render(
    <ShortcutEditor
      item={item}
      initialParentId="desktop"
      workspace={workspace}
      update={(change) => {
        workspace = change(workspace)
      }}
      onClose={() => {}}
    />,
  )
  const trigger = screen.getByRole('combobox', { name: '放置位置' })
  expect(trigger.textContent).toContain('开发工具')
  fireEvent.keyDown(trigger, { key: 'ArrowDown' })
  fireEvent.click(await screen.findByRole('option', { name: '桌面' }))
  await waitFor(() => expect(trigger.textContent).toContain('桌面'))
  fireEvent.click(screen.getByRole('button', { name: '保存修改' }))
  expect(workspace.items.some((entry) => entry.id === item.id)).toBe(true)
})
