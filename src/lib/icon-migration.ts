import { iconNames } from './icon-presets'
import type { IconName } from './icon-presets'

const aliases: Record<string, IconName> = {
  'book-open': 'book',
  'chart-line': 'chart',
  'circle-check': 'check-circle',
  'code-xml': 'code',
  earth: 'globe',
  'flower-2': 'flower',
  'gamepad-2': 'gamepad',
  'grid-2x2': 'grid',
  house: 'home',
  'key-round': 'key',
  'lock-keyhole': 'lock',
  'music-2': 'music',
  'pen-tool': 'design',
  'share-2': 'share',
  'sliders-horizontal': 'sliders',
  'train-front': 'train',
  'tv-minimal': 'video',
  video: 'video-call',
  'wand-sparkles': 'wand',
}
const supported = new Set<string>(iconNames)

// Read workspaces produced by the full-library version using the curated ID format.
export function migrateIconName(value: unknown): unknown {
  if (typeof value !== 'string' || !value.startsWith('lucide:')) return value
  const name = value.slice(7)
  return Object.hasOwn(aliases, name) ? aliases[name] : supported.has(name) ? name : 'globe'
}
