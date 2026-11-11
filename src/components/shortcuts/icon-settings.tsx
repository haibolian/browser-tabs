import { Github } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import type { IconAppearance } from '@/lib/icon-appearance'
import { cn } from '@/lib/utils'
import { IconColorPicker } from './icon-color-picker'

function RangeSetting({
  label,
  value,
  min,
  max,
  step = 1,
  unit = 'px',
  onChange,
  disabled = false,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (value: number) => void
  disabled?: boolean
}) {
  return (
    <div className={cn('flex items-center gap-4', disabled && 'opacity-40')}>
      <span className="w-[76px] shrink-0 text-xs text-muted-foreground">{label}</span>
      <Slider
        aria-label={label}
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={([next]) => onChange(next)}
      />
      <output className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {value} {unit}
      </output>
    </div>
  )
}

export function IconSettings({
  value,
  onChange,
}: {
  value: IconAppearance
  onChange: (value: IconAppearance) => void
}) {
  function set<K extends keyof IconAppearance>(key: K, next: IconAppearance[K]) {
    onChange({ ...value, [key]: next })
  }
  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-primary/4 p-4">
        <div className="mb-5 grid grid-cols-2 gap-3" role="group" aria-label="图标形状">
          {(['rounded', 'circle'] as const).map((shape) => (
            <button
              key={shape}
              type="button"
              aria-label={shape === 'rounded' ? '默认圆角图标' : '圆形图标'}
              aria-pressed={value.shape === shape}
              onClick={() => set('shape', shape)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border py-4 text-xs transition-colors',
                value.shape === shape
                  ? 'border-foreground/60 bg-surface'
                  : 'border-transparent hover:bg-surface-hover',
              )}
            >
              <span
                className={cn(
                  'flex size-14 items-center justify-center border border-border bg-shortcut',
                  shape === 'circle' ? 'rounded-full' : 'rounded-[17px]',
                )}
              >
                <Github size={27} strokeWidth={1.5} />
              </span>
              {shape === 'rounded' ? '默认' : '圆形'}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          <RangeSetting
            label="图标大小"
            value={value.size}
            min={50}
            max={100}
            onChange={(next) => set('size', next)}
          />
          <RangeSetting
            label="图标圆角"
            value={value.radius}
            min={0}
            max={30}
            disabled={value.shape === 'circle'}
            onChange={(next) => set('radius', next)}
          />
          <RangeSetting
            label="不透明度"
            value={Math.round(value.opacity * 100)}
            min={20}
            max={100}
            unit="%"
            onChange={(next) => set('opacity', next / 100)}
          />
        </div>
      </section>
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-medium">间距</h3>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            同步
            <Switch
              aria-label="同步图标横纵间距"
              checked={value.syncGap}
              onCheckedChange={(syncGap) =>
                onChange({ ...value, syncGap, gapY: syncGap ? value.gapX : value.gapY })
              }
            />
          </label>
        </div>
        <div className="space-y-3 rounded-2xl bg-primary/4 p-4">
          <RangeSetting
            label={value.syncGap ? '图标间距' : '横向间距'}
            value={value.gapX}
            min={0}
            max={100}
            onChange={(gapX) =>
              onChange({ ...value, gapX, gapY: value.syncGap ? gapX : value.gapY })
            }
          />
          {!value.syncGap && (
            <RangeSetting
              label="纵向间距"
              value={value.gapY}
              min={0}
              max={100}
              onChange={(next) => set('gapY', next)}
            />
          )}
        </div>
      </section>
      <section>
        <h3 className="mb-3 text-xs font-medium">名称</h3>
        <div className="space-y-4 rounded-2xl bg-primary/4 p-4">
          <label className="flex cursor-pointer items-center justify-between text-xs text-muted-foreground">
            显示图标名称
            <Switch
              aria-label="显示图标名称"
              checked={value.showName}
              onCheckedChange={(next) => set('showName', next)}
            />
          </label>
          <RangeSetting
            label="名称文字大小"
            value={value.nameSize}
            min={12}
            max={20}
            onChange={(next) => set('nameSize', next)}
          />
          <fieldset>
            <legend className="mb-3 text-xs text-muted-foreground">名称颜色</legend>
            <IconColorPicker
              label="名称颜色"
              value={value.nameColor}
              onChange={(color) => set('nameColor', color)}
              automatic
            />
          </fieldset>
        </div>
      </section>
      <section>
        <h3 className="mb-3 text-xs font-medium">图标区域</h3>
        <div className="rounded-2xl bg-primary/4 p-4">
          <RangeSetting
            label="最大宽度"
            value={value.maxWidth}
            min={900}
            max={2000}
            step={10}
            onChange={(next) => set('maxWidth', next)}
          />
        </div>
      </section>
    </div>
  )
}
