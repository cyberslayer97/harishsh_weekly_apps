// Downloads the MoveNet Lightning pose model (TensorFlow Lite) into assets/models/.
// Run once:  npm run model
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { MODEL_PATH, extractTflite, isTflite } from './modelFile.mjs'

// Tried in order. The first one that returns a valid model wins. Archives (.tar.gz) are unpacked.
const SOURCES = [
  'https://tfhub.dev/google/lite-model/movenet/singlepose/lightning/tflite/float16/4?lite-format=tflite',
  'https://www.kaggle.com/models/google/movenet/tfLite/singlepose-lightning-tflite-float16/download',
  'https://www.kaggle.com/api/v1/models/google/movenet/tfLite/singlepose-lightning-tflite-float16/download',
]

async function existing() {
  try {
    return isTflite(await readFile(MODEL_PATH))
  } catch {
    return false
  }
}

if (await existing()) {
  console.log(`Model already present: ${MODEL_PATH}`)
  process.exit(0)
}

for (const url of SOURCES) {
  try {
    console.log('Downloading', url)
    const res = await fetch(url, { redirect: 'follow' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const model = extractTflite(new Uint8Array(await res.arrayBuffer()))
    if (model == null) throw new Error('the download is not a TensorFlow Lite model (the site may have returned a web page)')
    await mkdir(dirname(MODEL_PATH), { recursive: true })
    const partial = `${MODEL_PATH}.partial`
    await writeFile(partial, model)
    await rename(partial, MODEL_PATH) // so a failed download never leaves a broken model behind
    console.log(`Saved ${(model.length / 1e6).toFixed(1)} MB to ${MODEL_PATH}`)
    process.exit(0)
  } catch (e) {
    console.log('  failed:', e.message)
  }
}

console.error(`
Could not download the model automatically.
Download "MoveNet SinglePose Lightning (TFLite, float16)" by hand from
  https://www.kaggle.com/models/google/movenet/tfLite/singlepose-lightning-tflite-float16
(if you get a .tar.gz, unpack it) and save the .tflite file as:
  ${MODEL_PATH}
`)
process.exit(1)
