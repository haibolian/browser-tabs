// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { ClockSearch } from './clock-search'
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
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function Search() {
  const [workspace, update] = useState(createWorkspace)
  return <ClockSearch workspace={workspace} update={update} />
}

it('搜索引擎用 Select 单选，切换不提交搜索，随后使用所选引擎搜索', async () => {
  const open = vi.spyOn(window, 'open').mockReturnValue(null)
  render(<Search />)
  const input = screen.getByRole('textbox', { name: '搜索内容' })
  fireEvent.change(input, { target: { value: '图标 测试' } })
  const trigger = screen.getByRole('combobox', { name: '选择搜索引擎，当前必应' })
  trigger.focus()
  fireEvent.keyDown(trigger, { key: 'ArrowDown' })
  const google = await screen.findByRole('option', { name: 'Google' })
  expect(screen.getByRole('listbox').getAttribute('data-slot')).toBe('select-content')
  fireEvent.click(google)
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
  expect(screen.getByRole('combobox', { name: '选择搜索引擎，当前Google' })).toBe(trigger)
  expect(open).not.toHaveBeenCalled()
  await waitFor(() => expect(document.activeElement).toBe(trigger))
  fireEvent.keyDown(trigger, { key: ' ' })
  await screen.findByRole('listbox')
  fireEvent.keyDown(document.activeElement!, { key: '/' })
  expect(document.activeElement).not.toBe(input)
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
  fireEvent.click(screen.getByRole('button', { name: '开始搜索' }))
  expect(open).toHaveBeenCalledWith(
    `https://www.google.com/search?q=${encodeURIComponent('图标 测试')}`,
    '_blank',
    'noopener,noreferrer',
  )
})
