import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SiteIcon } from '../components/shortcuts/site-icon'
import { findPresetIcons, iconNames, presetIcons } from './icon-presets'
import { createWorkspace, findShortcut, shortcutSchema, workspaceSchema } from './workspace'

describe('Lucide 通用预设', () => {
  it('可以按中文、英文、多词和全角关键词搜索', () => {
    expect(findPresetIcons('日历').map((icon) => icon.id)).toEqual(['calendar'])
    expect(findPresetIcons('  ＣＡＬＥＮＤＡＲ  ').map((icon) => icon.id)).toEqual([
      'calendar',
      'calendar-check',
    ])
    expect(findPresetIcons('git request').map((icon) => icon.id)).toEqual(['git-pull-request'])
    expect(findPresetIcons('map-pin').map((icon) => icon.id)).toEqual(['map-pin'])
    expect(findPresetIcons('二维码').map((icon) => icon.id)).toEqual(['qr-code'])
    expect(findPresetIcons('不存在的图标')).toEqual([])
  })

  it('搜索限制在当前分类，空查询显示当前分类的全部选项', () => {
    expect(
      findPresetIcons('', 'development').every((icon) => icon.category === 'development'),
    ).toBe(true)
    expect(findPresetIcons('cloud', 'development').map((icon) => icon.id)).toEqual(['cloud'])
    expect(findPresetIcons('cloud', 'nature').map((icon) => icon.id)).toEqual([
      'cloud-sun',
      'cloud-rain',
    ])
    expect(findPresetIcons('cloud', 'work')).toEqual([])
    expect(findPresetIcons('  ')).toHaveLength(presetIcons.length)
  })

  it('所有新图标能通过备份校验，并保留桌面、分组中的图标和自定义颜色', () => {
    const state = createWorkspace()
    const base = findShortcut(state.items, 'github')!
    const sites = presetIcons.map((icon, index) => ({
      ...base,
      id: `preset-${index}`,
      icon: icon.id,
      iconSource: 'preset' as const,
      color: '#123456',
    }))
    const items = [
      ...sites.slice(0, 1),
      { id: 'presets', kind: 'folder', title: '通用图标', color: '#406956', items: sites.slice(1) },
    ]
    const restored = workspaceSchema.parse(JSON.parse(JSON.stringify({ ...state, items })))
    expect(restored.items).toEqual(items)
  })

  it('旧存档图标继续渲染，拒绝未知 ID，所有通用预设均生成 SVG', () => {
    const base = findShortcut(createWorkspace().items, 'github')!
    for (const icon of iconNames) {
      const site = shortcutSchema.parse({ ...base, icon, iconSource: 'preset' })
      const markup = renderToStaticMarkup(createElement(SiteIcon, { site }))
      expect(markup).toContain(icon === 'notion' ? '>N</span>' : '<svg')
    }
    expect(shortcutSchema.safeParse({ ...base, icon: 'unknown' }).success).toBe(false)
    expect(new Set(iconNames).size).toBe(iconNames.length)
    expect(findPresetIcons('github')).toEqual([])
  })
})
