// Stops the build early, with a clear message, if the pose model is missing or damaged.
import { readFile } from 'node:fs/promises'
import { MODEL_PATH, isTflite } from './modelFile.mjs'

try {
  if (isTflite(await readFile(MODEL_PATH))) process.exit(0)
} catch {}
console.error('The pose model is missing or damaged. Run:  npm run model')
process.exit(1)
