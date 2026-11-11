export const colorModes = ['light', 'dark', 'system'] as const
export type ColorMode = (typeof colorModes)[number]
export type ResolvedTheme = Exclude<ColorMode, 'system'>

export function resolveTheme(mode: ColorMode, systemDark: boolean): ResolvedTheme {
  return mode === 'system' ? (systemDark ? 'dark' : 'light') : mode
}
