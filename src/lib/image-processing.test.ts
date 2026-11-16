import { expect, it } from 'vitest'
import { fitImage } from './image-processing'

it('图标和壁纸按比例缩小，保留横竖比且不放大小图', () => {
  expect(fitImage(6000, 4000, 256, 256)).toEqual({ width: 256, height: 171 })
  expect(fitImage(4000, 6000, 1920, 1080)).toEqual({ width: 720, height: 1080 })
  expect(fitImage(64, 64, 256, 256)).toEqual({ width: 64, height: 64 })
  expect(fitImage(10000, 1, 256, 256)).toEqual({ width: 256, height: 1 })
})
