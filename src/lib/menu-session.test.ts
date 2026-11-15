import { describe, expect, it, vi } from 'vitest'
import { createMenuSession } from './menu-session'

describe('菜单向面板交接焦点', () => {
  it('选中菜单项后等待菜单释放焦点，再打开面板', () => {
    const origin = { focus: vi.fn() }
    const openPanel = vi.fn()
    const session = createMenuSession()
    session.begin(origin)
    session.select(openPanel)
    expect(openPanel).not.toHaveBeenCalled()
    const preventDefault = vi.fn()
    session.finish({ preventDefault })
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(openPanel).toHaveBeenCalledTimes(1)
    expect(origin.focus).not.toHaveBeenCalled()
    expect(preventDefault.mock.invocationCallOrder[0]).toBeLessThan(
      openPanel.mock.invocationCallOrder[0],
    )
  })
  it('取消菜单时恢复原焦点，避免页面滚动', () => {
    const origin = { focus: vi.fn() }
    const session = createMenuSession()
    session.begin(origin)
    session.finish({ preventDefault: vi.fn() })
    expect(origin.focus).toHaveBeenCalledWith({ preventScroll: true })
  })
  it('重复关闭只执行一次操作', () => {
    const action = vi.fn()
    const session = createMenuSession()
    session.begin(null)
    session.select(action)
    session.finish({ preventDefault: vi.fn() })
    session.finish({ preventDefault: vi.fn() })
    expect(action).toHaveBeenCalledTimes(1)
  })
  it('重新打开菜单会清理上一轮未完成的操作', () => {
    const action = vi.fn()
    const origin = { focus: vi.fn() }
    const session = createMenuSession()
    session.begin(null)
    session.select(action)
    session.begin(origin)
    session.finish({ preventDefault: vi.fn() })
    expect(action).not.toHaveBeenCalled()
    expect(origin.focus).toHaveBeenCalledTimes(1)
  })
})
