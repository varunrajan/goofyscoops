import sharp from 'sharp'

const source = 'public/dog-avatar.png'
const bg = { r: 245, g: 214, b: 192, alpha: 1 } // #F5D6C0

const icons = [
  { file: 'public/icons/icon-192.png', size: 192, maskable: false },
  { file: 'public/icons/icon-512.png', size: 512, maskable: false },
  { file: 'public/icons/icon-maskable-192.png', size: 192, maskable: true },
  { file: 'public/icons/icon-maskable-512.png', size: 512, maskable: true },
  { file: 'public/icons/apple-touch-icon.png', size: 180, maskable: true },
  { file: 'public/favicon-32.png', size: 32, maskable: false },
  { file: 'public/favicon-16.png', size: 16, maskable: false },
]

for (const { file, size, maskable } of icons) {
  const padding = maskable ? Math.round(size * 0.2) : 0
  const inner = size - padding * 2
  await sharp(source)
    .resize(inner, inner)
    .extend({ top: padding, bottom: padding, left: padding, right: padding, background: bg })
    .toFile(file)
  console.log(`Generated ${file}`)
}

console.log('All icons generated.')
