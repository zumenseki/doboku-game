// PWAアイコン(192/512)を生成する。依存ライブラリなし（zlib + 手書きPNGエンコーダ）。
// 実行: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

const BG = [2, 132, 199] // sky-600
const PAPER = [255, 255, 255]
const LINE = [186, 230, 253] // sky-200
const CLIP = [14, 165, 233] // sky-500

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(size, pixels) {
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixels[y][x]
      const i = y * (size * 3 + 1) + 1 + x * 3
      raw[i] = r
      raw[i + 1] = g
      raw[i + 2] = b
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function draw(size) {
  const px = Array.from({ length: size }, () => Array.from({ length: size }, () => BG))
  const u = size / 100 // 100分率で座標指定する

  const rect = (x, y, w, h, color, radius = 0) => {
    for (let iy = Math.round(y * u); iy < Math.round((y + h) * u); iy++) {
      for (let ix = Math.round(x * u); ix < Math.round((x + w) * u); ix++) {
        if (iy < 0 || iy >= size || ix < 0 || ix >= size) continue
        if (radius > 0) {
          const r = radius * u
          const left = Math.round(x * u)
          const top = Math.round(y * u)
          const right = Math.round((x + w) * u) - 1
          const bottom = Math.round((y + h) * u) - 1
          const cx = ix < left + r ? left + r : ix > right - r ? right - r : ix
          const cy = iy < top + r ? top + r : iy > bottom - r ? bottom - r : iy
          if ((ix - cx) ** 2 + (iy - cy) ** 2 > r * r) continue
        }
        px[iy][ix] = color
      }
    }
  }

  // クリップボード（用紙）
  rect(22, 20, 56, 66, PAPER, 6)
  // クリップ金具
  rect(40, 12, 20, 12, CLIP, 3)
  // 記入行
  rect(31, 40, 38, 5, LINE, 2)
  rect(31, 52, 38, 5, LINE, 2)
  rect(31, 64, 22, 5, LINE, 2)

  return px
}

mkdirSync(outDir, { recursive: true })
for (const size of [192, 512]) {
  writeFileSync(join(outDir, `icon-${size}.png`), encodePng(size, draw(size)))
  console.log(`generated icon-${size}.png`)
}
