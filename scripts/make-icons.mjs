import { writeFileSync, mkdirSync } from 'fs'
import { deflateSync } from 'zlib'

// ── PNG encoder ────────────────────────────────────────────────────────────────
const CRC_TABLE = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
  CRC_TABLE[n] = c
}
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function pngChunk(type, data) {
  const t = Buffer.from(type)
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crcBuf])
}
function makePNG(size, drawFn) {
  const pixels = new Uint8Array(size * size * 4)
  drawFn(pixels, size)

  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4
      const dst = y * (size * 4 + 1) + 1 + x * 4
      raw[dst] = pixels[src]; raw[dst+1] = pixels[src+1]
      raw[dst+2] = pixels[src+2]; raw[dst+3] = pixels[src+3]
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// ── Icon draw function ─────────────────────────────────────────────────────────
function drawIcon(pixels, size) {
  const cx = size / 2, cy = size / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const dx = x - cx, dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      const r = size * 0.42

      // Dark background
      pixels[i] = 13; pixels[i+1] = 13; pixels[i+2] = 15; pixels[i+3] = 255

      // Outer glow ring
      if (dist < r + 2 && dist > r - size * 0.06) {
        const alpha = Math.max(0, 1 - Math.abs(dist - r) / (size * 0.04))
        pixels[i] = 124; pixels[i+1] = 106; pixels[i+2] = 247
        pixels[i+3] = Math.round(alpha * 180)
      }

      // Inner circle (gradient from purple to light)
      if (dist < r * 0.72) {
        const t = dist / (r * 0.72)
        pixels[i]   = Math.round(124 + (200 - 124) * (1 - t))
        pixels[i+1] = Math.round(106 + (180 - 106) * (1 - t))
        pixels[i+2] = Math.round(247 + (255 - 247) * (1 - t))
        pixels[i+3] = 255
      }

      // Star center dot
      if (dist < r * 0.18) {
        pixels[i] = 255; pixels[i+1] = 255; pixels[i+2] = 255; pixels[i+3] = 255
      }
    }
  }
}

// ── ICO encoder (embeds a 256×256 PNG) ────────────────────────────────────────
function makeICO(pngData) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)   // reserved
  header.writeUInt16LE(1, 2)   // type: ICO
  header.writeUInt16LE(1, 4)   // count: 1 image

  const entry = Buffer.alloc(16)
  entry[0] = 0          // width  (0 = 256)
  entry[1] = 0          // height (0 = 256)
  entry[2] = 0          // color count
  entry[3] = 0          // reserved
  entry.writeUInt16LE(1, 4)    // planes
  entry.writeUInt16LE(32, 6)   // bit count
  entry.writeUInt32LE(pngData.length, 8)
  entry.writeUInt32LE(6 + 16, 12)  // offset = header + entry

  return Buffer.concat([header, entry, pngData])
}

// ── Generate all files ─────────────────────────────────────────────────────────
mkdirSync('src-tauri/icons', { recursive: true })

for (const size of [32, 128, 256, 512]) {
  const png = makePNG(size, drawIcon)
  writeFileSync(`src-tauri/icons/${size}x${size}.png`, png)
  console.log(`✓ ${size}x${size}.png`)
}

// 128@2x = 256px
writeFileSync('src-tauri/icons/128x128@2x.png', makePNG(256, drawIcon))
console.log('✓ 128x128@2x.png')

// icon.png (512px, used for system tray / general)
writeFileSync('src-tauri/icons/icon.png', makePNG(512, drawIcon))
console.log('✓ icon.png')

// icon.ico (256px PNG embedded in ICO container — valid for Windows)
writeFileSync('src-tauri/icons/icon.ico', makeICO(makePNG(256, drawIcon)))
console.log('✓ icon.ico')

// icon.icns placeholder (required by tauri.conf.json for macOS, ignored on Windows build)
writeFileSync('src-tauri/icons/icon.icns', Buffer.from('icns\x00\x00\x00\x08', 'binary'))
console.log('✓ icon.icns (placeholder)')

console.log('\nAll icons generated in src-tauri/icons/')
