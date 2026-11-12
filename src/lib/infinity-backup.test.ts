import { describe, expect, it } from 'vitest'
import { importInfinityBackup } from './infinity-backup'
import { createWorkspace } from './workspace'

const site = {
  id: 'site-1',
  name: '网站',
  type: 'web',
  target: 'https://example.com/path?q=1',
  bgType: 'image',
  bgImage: 'https://example.com/icon.png',
}
const backup = (sites: unknown[][], todos: unknown[] = []) => ({
  version: 'v2',
  data: { site: { sites }, note: { list: [] }, todo: { todoList: todos } },
})

describe('Infinity v2 导入', () => {
  it('空名称网站保留地址和图片，并明确说明使用域名显示', () => {
    const result = importInfinityBackup(backup([[{ ...site, name: '' }]]))
    expect(result.workspace.items[0]).toMatchObject({
      title: 'example.com',
      url: site.target,
      favicon: site.bgImage,
    })
    expect(result.notices.join(' ')).toContain('未填写名称，将以域名显示：example.com')
  })
  it('合并多页，保留网站、分组及组内顺序和原始图标地址', () => {
    const result = importInfinityBackup(
      backup([
        [
          site,
          {
            id: 'folder-1',
            name: '工具',
            children: [
              { ...site, id: 'child-1' },
              { ...site, id: 'child-2' },
            ],
          },
        ],
        [{ ...site, id: 'site-2' }],
      ]),
    )
    expect(result.workspace.items.map((entry) => entry.id)).toEqual([
      'infinity:site-1',
      'infinity:folder-1',
      'infinity:site-2',
    ])
    expect(result.workspace.items[0]).toMatchObject({
      url: site.target,
      favicon: site.bgImage,
      iconSource: 'site',
    })
    expect(result.workspace.items[1]).toMatchObject({
      kind: 'folder',
      items: [{ id: 'infinity:child-1' }, { id: 'infinity:child-2' }],
    })
    expect(result.workspace.desktopOrder).toEqual(result.workspace.items.map((entry) => entry.id))
    expect(result.workspace.iconSizes['infinity:folder-1']).toBe('1x1')
    expect(result.workspace.todos).toEqual([])
    expect(result.workspace.notes).toEqual([])
  })

  it.each([
    ['rgba(255,71,52,1)', '#ff4734'],
    ['rgb(109, 9, 255)', '#6d09ff'],
    ['rgba(0, 0, 0, 0)', 'transparent'],
    ['rgba(0, 0, 0, 0.5)', '#00000080'],
  ])('保留文字和背景色 %s', (bgColor, expected) => {
    const result = importInfinityBackup(
      backup([[{ ...site, bgType: 'color', bgColor, bgText: '中文 AI' }]]),
    )
    expect(result.workspace.items[0]).toMatchObject({
      iconSource: 'text',
      iconText: '中文 AI',
      iconBackground: expected,
      favicon: null,
    })
  })

  it('在预览中说明跳过的内置应用和非网页链接，保留当前设置', () => {
    const settings = { ...createWorkspace().settings, theme: 'dark' as const }
    const result = importInfinityBackup(
      backup([
        [
          site,
          { ...site, id: 'app', name: '壁纸库', type: 'app', target: 'infinity://wallpaper' },
          { ...site, id: 'invalid', name: '本地链接', target: 'javascript:alert(1)' },
        ],
      ]),
      settings,
    )
    expect(result.workspace.items).toHaveLength(1)
    expect(result.workspace.settings).toEqual(settings)
    expect(result.notices.join(' ')).toContain('壁纸库、本地链接')
    expect(result.notices.join(' ')).toContain('保留留白当前设置')
  })

  it('拒绝损坏的格式、重复标识和不完整图标，避免部分导入', () => {
    expect(() => importInfinityBackup({ version: 'v2', data: {} })).toThrow('备份结构不正确')
    expect(() => importInfinityBackup(backup([[site, site]]))).toThrow()
    expect(() => importInfinityBackup(backup([[{ ...site, bgImage: undefined }]]))).toThrow(
      '缺少图标图片',
    )
    expect(() =>
      importInfinityBackup(backup([[{ ...site, bgType: 'color', bgText: '' }]])),
    ).toThrow()
    expect(() =>
      importInfinityBackup(backup([[{ ...site, bgColor: 'rgba(999, 0, 0, 1)' }]])),
    ).toThrow('背景色无效')
  })

  it('未确认的非空待办格式明确报错，不悄悄丢弃数据', () => {
    expect(() => importInfinityBackup(backup([[site]], [{ id: 'todo-1' }]))).toThrow(
      '尚不支持的待办格式',
    )
  })
})
