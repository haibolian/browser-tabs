export function fitImage(width: number, height: number, maxWidth: number, maxHeight: number) {
  const scale = Math.min(1, maxWidth / width, maxHeight / height)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

async function isAnimated(file: Blob) {
  if (file.type === 'image/gif' || file.type === 'image/avif' || file.type === 'image/svg+xml')
    return true
  if (!['image/png', 'image/webp'].includes(file.type)) return false
  const data = new Uint8Array(await file.arrayBuffer())
  const view = new DataView(data.buffer)
  const png = file.type === 'image/png'
  // Inspect chunk headers, never compressed pixel data, to preserve APNG/WebP animations.
  for (let offset = png ? 8 : 12; offset + 8 <= data.length;) {
    const typeOffset = offset + (png ? 4 : 0)
    const tag = String.fromCharCode(...data.subarray(typeOffset, typeOffset + 4))
    if (tag === 'acTL' || tag === 'ANIM') return true
    const length = view.getUint32(offset + (png ? 0 : 4), !png)
    offset += png ? length + 12 : length + 8 + (length % 2)
  }
  return false
}

async function decodeImage(file: Blob) {
  try {
    const bitmap = await createImageBitmap(file)
    return {
      image: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    }
  } catch {
    const url = URL.createObjectURL(file)
    try {
      const image = new Image()
      image.src = url
      await image.decode()
      return {
        image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        close: () => URL.revokeObjectURL(url),
      }
    } catch {
      URL.revokeObjectURL(url)
      throw new Error('无法读取这张图片')
    }
  }
}

export async function prepareImage(file: Blob, maxWidth: number, maxHeight: number) {
  const decoded = await decodeImage(file)
  try {
    const sample = document.createElement('canvas')
    sample.width = sample.height = 16
    const context = sample.getContext('2d')
    if (!context) throw new Error('无法处理图片')
    context.drawImage(decoded.image, 0, 0, 16, 16)
    const pixels = context.getImageData(0, 0, 16, 16).data
    let brightness = 0
    for (let index = 0; index < pixels.length; index += 4) {
      brightness +=
        (pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722) / 255
    }
    brightness /= 256
    const size = fitImage(decoded.width, decoded.height, maxWidth, maxHeight)
    if (
      (size.width === decoded.width && size.height === decoded.height) ||
      (await isAnimated(file))
    ) {
      return { blob: file, brightness }
    }
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const output = canvas.getContext('2d')
    if (!output) throw new Error('无法缩放图片')
    output.drawImage(decoded.image, 0, 0, size.width, size.height)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('无法保存缩放后的图片'))),
        'image/webp',
        0.9,
      )
    })
    return { blob, brightness }
  } finally {
    decoded.close()
  }
}
