import { Check } from 'lucide-react'
import { iconColors } from '@/lib/icon-appearance'
import { cn } from '@/lib/utils'

export function IconColorPicker({
  value,
  onChange,
  label = '图标背景色',
  transparent = false,
  automatic = false,
}: {
  value: string | null
  onChange: (color: string | null) => void
  label?: string
  transparent?: boolean
  automatic?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-3" role="group" aria-label={label}>
      {automatic && (
        <button
          type="button"
          className={cn(
            'icon-color-swatch bg-surface text-[10px] text-foreground',
            value === null && 'selected',
          )}
          aria-label="名称颜色跟随主题"
          aria-pressed={value === null}
          onClick={() => onChange(null)}
        >
          A
        </button>
      )}
      {iconColors.map((color) => (
        <button
          type="button"
          key={color}
          className={cn('icon-color-swatch', value === color && 'selected')}
          style={{ background: color }}
          aria-label={`${label} ${color}`}
          aria-pressed={value === color}
          onClick={() => onChange(color)}
        >
          {value === color && (
            <Check
              size={12}
              style={{
                color: ['#ffffff', '#fbbe23', '#a3ddb9'].includes(color) ? '#171717' : '#ffffff',
              }}
            />
          )}
        </button>
      ))}
      {transparent && (
        <button
          type="button"
          className={cn(
            'icon-color-swatch transparency-grid',
            value === 'transparent' && 'selected',
          )}
          aria-label="透明背景"
          aria-pressed={value === 'transparent'}
          onClick={() => onChange('transparent')}
        >
          {value === 'transparent' && <Check size={12} className="text-black" />}
        </button>
      )}
      <label
        className="icon-color-swatch relative overflow-hidden bg-[conic-gradient(red,yellow,lime,aqua,blue,magenta,red)]"
        title="自定义颜色"
      >
        <input
          type="color"
          value={value && value !== 'transparent' ? value : '#1681ff'}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`自定义${label}`}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
        <span className="pointer-events-none size-2 rounded-full bg-white" />
      </label>
    </div>
  )
}
