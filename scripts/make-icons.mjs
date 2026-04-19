import { writeFileSync, mkdirSync, readFileSync } from 'fs'
import { deflateSync, inflateSync } from 'zlib'

// ── PNG decoder (minimal — handles RGBA and RGB) ───────────────────────────────
function crc32(buf) {
  const T = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    T[n] = c
  }
  let c = 0xffffffff
  for (const b of buf) c = T[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const t = Buffer.from(type)
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crcBuf])
}

function decodePNG(buf) {
  let pos = 8 // skip signature
  const chunks = {}
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos); pos += 4
    const type = buf.slice(pos, pos + 4).toString(); pos += 4
    const data = buf.slice(pos, pos + len); pos += len + 4
    if (!chunks[type]) chunks[type] = []
    chunks[type].push(data)
  }
  const ihdr = chunks['IHDR'][0]
  const w = ihdr.readUInt32BE(0), h = ihdr.readUInt32BE(4)
  const bitDepth = ihdr[8], colorType = ihdr[9]

  const raw = inflateSync(Buffer.concat(chunks['IDAT']))
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 4
  const pixels = new Uint8Array(w * h * 4)

  for (let y = 0; y < h; y++) {
    const filter = raw[y * (w * channels + 1)]
    for (let x = 0; x < w; x++) {
      const src = y * (w * channels + 1) + 1 + x * channels
      const dst = (y * w + x) * 4
      if (colorType === 6) {
        pixels[dst]   = raw[src]
        pixels[dst+1] = raw[src+1]
        pixels[dst+2] = raw[src+2]
        pixels[dst+3] = raw[src+3]
      } else {
        pixels[dst]   = raw[src]
        pixels[dst+1] = raw[src+1]
        pixels[dst+2] = raw[src+2]
        pixels[dst+3] = 255
      }
    }
  }
  return { w, h, pixels }
}

// ── PNG encoder ────────────────────────────────────────────────────────────────
function encodePNG(w, h, pixels) {
  const raw = Buffer.alloc(h * (w * 4 + 1))
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0
    for (let x = 0; x < w; x++) {
      const src = (y * w + x) * 4
      const dst = y * (w * 4 + 1) + 1 + x * 4
      raw[dst] = pixels[src]; raw[dst+1] = pixels[src+1]
      raw[dst+2] = pixels[src+2]; raw[dst+3] = pixels[src+3]
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// ── Bilinear resize ────────────────────────────────────────────────────────────
function resize(src, sw, sh, dw, dh) {
  const out = new Uint8Array(dw * dh * 4)
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const sx = (x + 0.5) * (sw / dw) - 0.5
      const sy = (y + 0.5) * (sh / dh) - 0.5
      const x0 = Math.max(0, Math.floor(sx)), x1 = Math.min(sw - 1, x0 + 1)
      const y0 = Math.max(0, Math.floor(sy)), y1 = Math.min(sh - 1, y0 + 1)
      const fx = sx - x0, fy = sy - y0
      const di = (y * dw + x) * 4
      for (let c = 0; c < 4; c++) {
        const tl = src[(y0 * sw + x0) * 4 + c]
        const tr = src[(y0 * sw + x1) * 4 + c]
        const bl = src[(y1 * sw + x0) * 4 + c]
        const br = src[(y1 * sw + x1) * 4 + c]
        out[di + c] = Math.round(tl*(1-fx)*(1-fy) + tr*fx*(1-fy) + bl*(1-fx)*fy + br*fx*fy)
      }
    }
  }
  return out
}

// ── Composite logo onto dark background ───────────────────────────────────────
function makeIconAtSize(logoPixels, lw, lh, size) {
  const out = new Uint8Array(size * size * 4)
  const bg = { r: 13, g: 13, b: 15 }

  // Logo fits inside 80% of the icon with padding
  const padding = Math.round(size * 0.1)
  const logoSize = size - padding * 2
  const scaledLogo = resize(logoPixels, lw, lh, logoSize, logoSize)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4

      // Dark background
      out[i] = bg.r; out[i+1] = bg.g; out[i+2] = bg.b; out[i+3] = 255

      // Paste logo
      const lx = x - padding, ly = y - padding
      if (lx >= 0 && lx < logoSize && ly >= 0 && ly < logoSize) {
        const li = (ly * logoSize + lx) * 4
        const lr = scaledLogo[li], lg = scaledLogo[li+1], lb = scaledLogo[li+2]
        const la = scaledLogo[li+3]

        // The logo is black on white — invert: make white transparent, black → white
        // so it shows on the dark background
        const brightness = (lr + lg + lb) / 3
        const logoAlpha = (1 - brightness / 255) * (la / 255)

        if (logoAlpha > 0.01) {
          // Alpha-blend white logo onto dark bg
          const a = logoAlpha
          out[i]   = Math.round(bg.r * (1 - a) + 255 * a)
          out[i+1] = Math.round(bg.g * (1 - a) + 255 * a)
          out[i+2] = Math.round(bg.b * (1 - a) + 255 * a)
          out[i+3] = 255
        }
      }
    }
  }
  return out
}

// ── ICO encoder ───────────────────────────────────────────────────────────────
function makeICO(pngData) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4)
  const entry = Buffer.alloc(16)
  entry[0] = 0; entry[1] = 0; entry[2] = 0; entry[3] = 0
  entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6)
  entry.writeUInt32LE(pngData.length, 8); entry.writeUInt32LE(22, 12)
  return Buffer.concat([header, entry, pngData])
}

// ── Run ────────────────────────────────────────────────────────────────────────
mkdirSync('src-tauri/icons', { recursive: true })

const src = readFileSync('scripts/logo-source.png')
const { w: lw, h: lh, pixels: logoPixels } = decodePNG(src)
console.log(`Source logo: ${lw}×${lh}`)

for (const size of [32, 128, 256, 512]) {
  const pixels = makeIconAtSize(logoPixels, lw, lh, size)
  writeFileSync(`src-tauri/icons/${size}x${size}.png`, encodePNG(size, size, pixels))
  console.log(`✓ ${size}x${size}.png`)
}

const p256 = makeIconAtSize(logoPixels, lw, lh, 256)
writeFileSync('src-tauri/icons/128x128@2x.png', encodePNG(256, 256, p256))
console.log('✓ 128x128@2x.png')

writeFileSync('src-tauri/icons/icon.png', encodePNG(512, 512, makeIconAtSize(logoPixels, lw, lh, 512)))
console.log('✓ icon.png')

const ico256 = makeIconAtSize(logoPixels, lw, lh, 256)
writeFileSync('src-tauri/icons/icon.ico', makeICO(encodePNG(256, 256, ico256)))
console.log('✓ icon.ico')

writeFileSync('src-tauri/icons/icon.icns', Buffer.from('icns\x00\x00\x00\x08', 'binary'))
console.log('✓ icon.icns (placeholder)')

// Also copy 512px version to public/ for PWA manifest
writeFileSync('public/icon-512.png', encodePNG(512, 512, makeIconAtSize(logoPixels, lw, lh, 512)))
writeFileSync('public/icon-192.png', encodePNG(192, 192, makeIconAtSize(logoPixels, lw, lh, 192)))
console.log('✓ public/icon-512.png + icon-192.png (PWA)')
console.log('\nAll icons generated.')
