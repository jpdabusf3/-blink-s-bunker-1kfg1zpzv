/**
 * Minimal in-memory ZIP builder (Store compression / method 0).
 * Implements standard PKZIP 2.0 format with CRC32.
 * Compatible with Excel (.xlsx), OpenOffice, Apple Numbers, Google Sheets.
 */

// CRC32 Lookup Table
const CRC32_TABLE = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  CRC32_TABLE[i] = c >>> 0
}

export function computeCrc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

export interface ZipEntryInput {
  name: string
  content: string | Uint8Array
}

interface ZipEntryProcessed {
  nameBytes: Uint8Array
  data: Uint8Array
  crc: number
  size: number
  offset: number
}

/**
 * Builds a valid ZIP archive containing the provided entries using uncompressed (Stored) mode.
 */
export function buildZip(entries: ZipEntryInput[]): Uint8Array {
  const textEncoder = new TextEncoder()
  const processed: ZipEntryProcessed[] = []

  let totalSize = 0

  for (const entry of entries) {
    const nameBytes = textEncoder.encode(entry.name)
    const data =
      typeof entry.content === 'string' ? textEncoder.encode(entry.content) : entry.content
    const crc = computeCrc32(data)
    const size = data.length

    // Local file header: 30 bytes + nameBytes.length + data.length
    const offset = totalSize
    totalSize += 30 + nameBytes.length + size

    processed.push({
      nameBytes,
      data,
      crc,
      size,
      offset,
    })
  }

  const centralDirStart = totalSize

  // Central directory size
  for (const p of processed) {
    // Central directory header: 46 bytes + nameBytes.length
    totalSize += 46 + p.nameBytes.length
  }

  const centralDirEnd = totalSize
  const centralDirSize = centralDirEnd - centralDirStart

  // End of central directory record: 22 bytes
  totalSize += 22

  const buffer = new Uint8Array(totalSize)
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)

  // Write local headers + file data
  for (const p of processed) {
    let pos = p.offset
    // Signature: 0x04034b50 (PK\x03\x04)
    view.setUint32(pos, 0x04034b50, true)
    // Version needed: 20 (2.0)
    view.setUint16(pos + 4, 20, true)
    // General purpose bit flag (0x0800 = UTF-8 filename)
    view.setUint16(pos + 6, 0x0800, true)
    // Compression method: 0 (Store)
    view.setUint16(pos + 8, 0, true)
    // Last mod file time / date: standard default (12:00:00, 2024-01-01)
    view.setUint16(pos + 10, 0x6000, true)
    view.setUint16(pos + 12, 0x5821, true)
    // CRC32
    view.setUint32(pos + 14, p.crc, true)
    // Compressed size
    view.setUint32(pos + 18, p.size, true)
    // Uncompressed size
    view.setUint32(pos + 22, p.size, true)
    // Filename length
    view.setUint16(pos + 26, p.nameBytes.length, true)
    // Extra field length
    view.setUint16(pos + 28, 0, true)
    pos += 30

    // Filename
    buffer.set(p.nameBytes, pos)
    pos += p.nameBytes.length

    // Data
    buffer.set(p.data, pos)
  }

  // Write Central Directory Headers
  let cdPos = centralDirStart
  for (const p of processed) {
    // Signature: 0x02014b50 (PK\x01\x02)
    view.setUint32(cdPos, 0x02014b50, true)
    // Version made by: 20 (DOS / ZIP 2.0)
    view.setUint16(cdPos + 4, 20, true)
    // Version needed: 20
    view.setUint16(cdPos + 6, 20, true)
    // Bit flag: UTF-8
    view.setUint16(cdPos + 8, 0x0800, true)
    // Compression method: 0
    view.setUint16(cdPos + 10, 0, true)
    // Mod time / date
    view.setUint16(cdPos + 12, 0x6000, true)
    view.setUint16(cdPos + 14, 0x5821, true)
    // CRC32
    view.setUint32(cdPos + 16, p.crc, true)
    // Sizes
    view.setUint32(cdPos + 20, p.size, true)
    view.setUint32(cdPos + 24, p.size, true)
    // Filename length
    view.setUint16(cdPos + 28, p.nameBytes.length, true)
    // Extra field length
    view.setUint16(cdPos + 30, 0, true)
    // File comment length
    view.setUint16(cdPos + 32, 0, true)
    // Disk number start
    view.setUint16(cdPos + 34, 0, true)
    // Internal file attributes
    view.setUint16(cdPos + 36, 0, true)
    // External file attributes
    view.setUint32(cdPos + 38, 0, true)
    // Relative offset of local header
    view.setUint32(cdPos + 42, p.offset, true)
    cdPos += 46

    // Filename
    buffer.set(p.nameBytes, cdPos)
    cdPos += p.nameBytes.length
  }

  // Write End of Central Directory Record (EOCD)
  // Signature: 0x06054b50 (PK\x05\x06)
  view.setUint32(cdPos, 0x06054b50, true)
  // Number of this disk
  view.setUint16(cdPos + 4, 0, true)
  // Disk where CD starts
  view.setUint16(cdPos + 6, 0, true)
  // Number of CD records on this disk
  view.setUint16(cdPos + 8, processed.length, true)
  // Total number of CD records
  view.setUint16(cdPos + 10, processed.length, true)
  // Size of CD
  view.setUint32(cdPos + 12, centralDirSize, true)
  // Offset of CD
  view.setUint32(cdPos + 16, centralDirStart, true)
  // Comment length
  view.setUint16(cdPos + 20, 0, true)

  return buffer
}
