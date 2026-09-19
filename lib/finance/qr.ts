// lib/finance/qr.ts
// Generator QR Code murni TypeScript (Zero Dependency)
// Menghasilkan matriks QR Code dan string SVG standar.
// Kompatibel dengan Cloudflare Workers, SSR, dan Browser Client.

export type QrErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H'

export interface QrSvgOptions {
  size?: number
  margin?: number
  darkColor?: string
  lightColor?: string
  title?: string
}

// ─── GALOIS FIELD GF(256) & REED-SOLOMON ARITHMETIC ─────────────────────────

const GF_EXP = new Uint8Array(512)
const GF_LOG = new Uint8Array(256)

;(function initGaloisField() {
  let x = 1
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x
    GF_LOG[x] = i
    x <<= 1
    if (x & 0x100) {
      x ^= 0x11d // Primitive polynomial: x^8 + x^4 + x^3 + x^2 + 1
    }
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255]
  }
})()

function gfMultiply(x: number, y: number): number {
  if (x === 0 || y === 0) return 0
  return GF_EXP[GF_LOG[x] + GF_LOG[y]]
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1])
  for (let i = 0; i < degree; i++) {
    const nextPoly = new Uint8Array(poly.length + 1)
    const factor = GF_EXP[i]
    for (let j = 0; j < poly.length; j++) {
      nextPoly[j] ^= gfMultiply(poly[j], factor)
      nextPoly[j + 1] ^= poly[j]
    }
    poly = nextPoly
  }
  return poly
}

function rsCalculateEc(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = rsGeneratorPoly(ecCount)
  const remainder = new Uint8Array(ecCount)
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ remainder[0]
    for (let j = 0; j < ecCount - 1; j++) {
      remainder[j] = remainder[j + 1] ^ gfMultiply(gen[ecCount - 1 - j], factor)
    }
    remainder[ecCount - 1] = gfMultiply(gen[0], factor)
  }
  return remainder
}

// ─── TABEL VERSI QR CODE (Versi 1 s/d 6 untuk Token Kartu) ────────────────────

interface QrVersionCapacity {
  version: number
  totalCodewords: number
  ecCodewords: number // per block
  numBlocks: number
  alignmentCenters: number[]
}

// Kapasitas untuk Error Correction Level M (Medium - 15% recovery)
const QR_SPECS_LEVEL_M: QrVersionCapacity[] = [
  { version: 1, totalCodewords: 26, ecCodewords: 10, numBlocks: 1, alignmentCenters: [] },
  { version: 2, totalCodewords: 44, ecCodewords: 16, numBlocks: 1, alignmentCenters: [6, 18] },
  { version: 3, totalCodewords: 70, ecCodewords: 26, numBlocks: 1, alignmentCenters: [6, 22] },
  { version: 4, totalCodewords: 100, ecCodewords: 18, numBlocks: 2, alignmentCenters: [6, 26] },
  { version: 5, totalCodewords: 134, ecCodewords: 24, numBlocks: 2, alignmentCenters: [6, 30] },
  { version: 6, totalCodewords: 172, ecCodewords: 16, numBlocks: 4, alignmentCenters: [6, 34] },
]

// ─── BIT BUFFER ─────────────────────────────────────────────────────────────

class BitBuffer {
  private bits: number[] = []

  put(val: number, length: number) {
    for (let i = length - 1; i >= 0; i--) {
      this.bits.push((val >> i) & 1)
    }
  }

  get length(): number {
    return this.bits.length
  }

  getBit(index: number): number {
    return this.bits[index]
  }

  getBytes(): Uint8Array {
    const len = Math.ceil(this.bits.length / 8)
    const bytes = new Uint8Array(len)
    for (let i = 0; i < this.bits.length; i++) {
      if (this.bits[i]) {
        bytes[i >> 3] |= 0x80 >> (i & 7)
      }
    }
    return bytes
  }
}

// ─── PENYUSUN DATA CODEWORDS BYTE MODE ────────────────────────────────────────

function encodeByteData(text: string, spec: QrVersionCapacity): Uint8Array {
  const encoder = new TextEncoder()
  const rawBytes = encoder.encode(text)
  const dataCapacity = spec.totalCodewords - spec.ecCodewords * spec.numBlocks

  if (rawBytes.length + 3 > dataCapacity) {
    throw new Error(`Data terlalu panjang untuk QR Versi ${spec.version} Level M (maks ${dataCapacity - 3} byte).`)
  }

  const bb = new BitBuffer()
  // 1. Mode Indicator: 0100 (Byte mode)
  bb.put(0x4, 4)
  // 2. Character count indicator (8 bit untuk versi 1..9)
  bb.put(rawBytes.length, 8)
  // 3. Payload bytes
  for (let i = 0; i < rawBytes.length; i++) {
    bb.put(rawBytes[i], 8)
  }
  // 4. Terminator: 0000 (hingga 4 bit jika sisa muat)
  const maxBits = dataCapacity * 8
  const termBits = Math.min(4, maxBits - bb.length)
  bb.put(0x0, termBits)
  // 5. Pad ke kelipatan 8 bit
  while (bb.length % 8 !== 0) {
    bb.put(0x0, 1)
  }
  // 6. Pad bytes 0xEC dan 0x11 selang-seling hingga penuh
  let padToggle = false
  while (bb.length < maxBits) {
    bb.put(padToggle ? 0x11 : 0xec, 8)
    padToggle = !padToggle
  }

  const dataBytes = bb.getBytes()
  // Bagi ke dalam blok dan hitung Reed-Solomon EC
  const blockSize = Math.floor(dataCapacity / spec.numBlocks)
  const dataBlocks: Uint8Array[] = []
  const ecBlocks: Uint8Array[] = []

  let offset = 0
  for (let b = 0; b < spec.numBlocks; b++) {
    const curBlockSize = blockSize + (b >= spec.numBlocks - (dataCapacity % spec.numBlocks) && (dataCapacity % spec.numBlocks) > 0 ? 1 : 0)
    const blockData = dataBytes.slice(offset, offset + curBlockSize)
    offset += curBlockSize
    dataBlocks.push(blockData)
    ecBlocks.push(rsCalculateEc(blockData, spec.ecCodewords))
  }

  // Interleave data blocks & EC blocks
  const result = new Uint8Array(spec.totalCodewords)
  let idx = 0

  // Interleave data
  const maxDataLen = Math.max(...dataBlocks.map(b => b.length))
  for (let i = 0; i < maxDataLen; i++) {
    for (let b = 0; b < spec.numBlocks; b++) {
      if (i < dataBlocks[b].length) {
        result[idx++] = dataBlocks[b][i]
      }
    }
  }

  // Interleave EC
  for (let i = 0; i < spec.ecCodewords; i++) {
    for (let b = 0; b < spec.numBlocks; b++) {
      result[idx++] = ecBlocks[b][i]
    }
  }

  return result
}

// ─── PEMBENTUK MATRIKS QR ───────────────────────────────────────────────────

function createQrMatrix(version: number, data: Uint8Array): boolean[][] {
  const size = 4 * version + 17
  // null = kosong, true = hitam/dark, false = putih/light
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () =>
    Array(size).fill(null)
  )
  const isFunctionPattern: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  )

  function setModule(r: number, c: number, dark: boolean, isFunc = false) {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      matrix[r][c] = dark
      if (isFunc) isFunctionPattern[r][c] = true
    }
  }

  // 1. Finder Patterns 7x7 pada 3 sudut
  function placeFinder(topRow: number, leftCol: number) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = topRow + r
        const col = leftCol + c
        if (row < 0 || row >= size || col < 0 || col >= size) continue
        if (
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          setModule(row, col, true, true)
        } else {
          setModule(row, col, false, true)
        }
      }
    }
  }

  placeFinder(0, 0)
  placeFinder(0, size - 7)
  placeFinder(size - 7, 0)

  // 2. Timing Patterns (Row 6 dan Col 6)
  for (let i = 8; i < size - 8; i++) {
    const isDark = i % 2 === 0
    if (matrix[6][i] === null) setModule(6, i, isDark, true)
    if (matrix[i][6] === null) setModule(i, 6, isDark, true)
  }

  // 3. Alignment Patterns (Versi >= 2)
  const spec = QR_SPECS_LEVEL_M[version - 1]
  const coords = spec.alignmentCenters
  for (let i = 0; i < coords.length; i++) {
    for (let j = 0; j < coords.length; j++) {
      const r = coords[i]
      const c = coords[j]
      // Lewati jika tumpang tindih dengan finder
      if (
        (r === 6 && c === 6) ||
        (r === 6 && c === coords[coords.length - 1] && coords[coords.length - 1] > size - 10) ||
        (r === coords[coords.length - 1] && c === 6 && coords[coords.length - 1] > size - 10)
      ) {
        continue
      }
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dark =
            Math.max(Math.abs(dr), Math.abs(dc)) === 2 || (dr === 0 && dc === 0)
          setModule(r + dr, c + dc, dark, true)
        }
      }
    }
  }

  // 4. Dark Module
  setModule(4 * version + 9, 8, true, true)

  // 5. Reservasi Format Information area
  for (let i = 0; i < 9; i++) {
    if (matrix[8][i] === null) setModule(8, i, false, true)
    if (matrix[i][8] === null) setModule(i, 8, false, true)
  }
  for (let i = size - 8; i < size; i++) {
    if (matrix[8][i] === null) setModule(8, i, false, true)
  }
  for (let i = size - 7; i < size; i++) {
    if (matrix[i][8] === null) setModule(i, 8, false, true)
  }

  // 6. Tempatkan Data Bits secara Zigzag (Kanan ke Kiri, Berpasangan 2 Kolom)
  let bitIndex = 0
  const totalBits = data.length * 8
  let upwards = true

  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right-- // Lewati col timing 6
    const left = right - 1

    for (let step = 0; step < size; step++) {
      const r = upwards ? size - 1 - step : step
      const cols = [right, left]

      for (const c of cols) {
        if (!isFunctionPattern[r][c]) {
          let bit = false
          if (bitIndex < totalBits) {
            const byteIdx = bitIndex >> 3
            const bitOffset = 7 - (bitIndex & 7)
            bit = ((data[byteIdx] >> bitOffset) & 1) === 1
            bitIndex++
          }
          matrix[r][c] = bit
        }
      }
    }
    upwards = !upwards
  }

  // 7. Terapkan Masking Pattern 0: (r + c) % 2 === 0 (pola seimbang untuk string acak)
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isFunctionPattern[r][c]) {
        const shouldMask = (r + c) % 2 === 0
        if (shouldMask) {
          matrix[r][c] = !matrix[r][c]
        }
      }
    }
  }

  // 8. Tulis Format Information (Level M = 00, Mask 0 = 000 -> Data 00000)
  // Format bit string dengan BCH dan XOR mask 0x5412:
  // Untuk Level M (00) dan Mask 0 (000) -> 0x5412 XOR 0x0000 = 0x5412 = 0101010000010010 (15 bit: 101010000010010)
  const formatInfoBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0]

  // Tempatkan format info di sekitar top-left finder
  for (let i = 0; i < 6; i++) matrix[8][i] = formatInfoBits[i] === 1
  matrix[8][7] = formatInfoBits[6] === 1
  matrix[8][8] = formatInfoBits[7] === 1
  matrix[7][8] = formatInfoBits[8] === 1
  for (let i = 9; i < 15; i++) matrix[14 - i][8] = formatInfoBits[i] === 1

  // Tempatkan format info duplikat pada 2 sudut lainnya
  for (let i = 0; i < 7; i++) matrix[size - 1 - i][8] = formatInfoBits[i] === 1
  for (let i = 7; i < 15; i++) matrix[8][size - 15 + i] = formatInfoBits[i] === 1

  return matrix.map(row => row.map(cell => Boolean(cell)))
}

/**
 * Memilih versi terkecil yang memadai untuk menampung teks pada Error Correction Level M.
 */
export function getQrMatrix(text: string): boolean[][] {
  const enc = new TextEncoder()
  const len = enc.encode(text).length

  let selectedSpec: QrVersionCapacity | null = null
  for (const spec of QR_SPECS_LEVEL_M) {
    const maxCapacity = spec.totalCodewords - spec.ecCodewords * spec.numBlocks - 3
    if (len <= maxCapacity) {
      selectedSpec = spec
      break
    }
  }

  if (!selectedSpec) {
    throw new Error(`Data teks (${len} byte) melebihi batas QR kartu maksimal (Versi 6).`)
  }

  const encodedData = encodeByteData(text, selectedSpec)
  return createQrMatrix(selectedSpec.version, encodedData)
}

/**
 * Menghasilkan string SVG murni yang dapat langsung di-render pada JSX `dangerouslySetInnerHTML`
 * atau disematkan langsung di dalam template cetak `@media print`.
 */
export function generateQrSvg(
  text: string,
  options?: QrSvgOptions
): string {
  const matrix = getQrMatrix(text)
  const matrixSize = matrix.length
  const margin = options?.margin ?? 2
  const totalGrid = matrixSize + margin * 2
  const targetSize = options?.size ?? 200
  const darkColor = options?.darkColor ?? '#0f172a'
  const lightColor = options?.lightColor ?? '#ffffff'
  const title = options?.title ?? 'QR Code Santri'

  // Kumpulkan modul hitam ke dalam single SVG path untuk rendering yang super cepat dan tajam
  let pathD = ''
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (matrix[r][c]) {
        const x = c + margin
        const y = r + margin
        pathD += `M${x},${y}h1v1h-1z `
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalGrid} ${totalGrid}" width="${targetSize}" height="${targetSize}" shape-rendering="crispEdges">
  <title>${title}</title>
  <rect width="${totalGrid}" height="${totalGrid}" fill="${lightColor}" />
  <path d="${pathD.trim()}" fill="${darkColor}" />
</svg>`
}
