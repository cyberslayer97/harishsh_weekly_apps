// Shared by download-model.mjs and ensure-model.mjs.
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

export const MODEL_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'models', 'movenet_lightning.tflite')

/** A TensorFlow Lite file has the identifier "TFL3" at bytes 4..8. */
export function isTflite(bytes) {
  return bytes.length > 100_000 && Buffer.from(bytes.subarray(4, 8)).toString('ascii') === 'TFL3'
}

const isGzip = (bytes) => bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b

/** The first file ending in `.tflite` inside a tar archive, or null. */
function findInTar(tar) {
  let offset = 0
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every((b) => b === 0)) break
    const name = Buffer.from(header.subarray(0, 100)).toString('utf8').replace(/\0.*$/, '')
    const size = parseInt(Buffer.from(header.subarray(124, 136)).toString('ascii').replace(/\0.*$/, '').trim() || '0', 8)
    const start = offset + 512
    if (name.endsWith('.tflite')) return tar.subarray(start, start + size)
    offset = start + Math.ceil(size / 512) * 512
  }
  return null
}

/** The model bytes from a download that is either the .tflite itself or a (gzipped) tar archive of it. */
export function extractTflite(bytes) {
  if (isTflite(bytes)) return bytes
  if (isGzip(bytes)) {
    const inner = gunzipSync(bytes)
    if (isTflite(inner)) return inner
    const found = findInTar(inner)
    if (found && isTflite(found)) return found
  }
  return null
}
