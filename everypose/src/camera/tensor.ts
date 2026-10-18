import type { Pose } from '../pose/keypoints'
import { parseMoveNetOutput } from '../pose/keypoints'

/** Side of the square image MoveNet Lightning takes. */
export const MOVENET_INPUT_SIZE = 192

/** The subset of a TFLite tensor description we look at. */
export interface TensorInfo {
  dataType: string
  shape: readonly number[]
}

const BYTES_PER_PIXEL = 3

/**
 * Checks that a loaded model is the MoveNet single-pose layout we expect and that we can feed
 * it. Returns a message to show the user, or null when the model is fine.
 */
export function validateModel(inputs: readonly TensorInfo[], outputs: readonly TensorInfo[]): string | null {
  const input = inputs[0]
  const output = outputs[0]
  if (input == null || output == null) return 'The pose model has no input or output.'
  const [n, h, w, c] = input.shape
  if (n !== 1 || h !== MOVENET_INPUT_SIZE || w !== MOVENET_INPUT_SIZE || c !== BYTES_PER_PIXEL) {
    return `Unexpected pose model input ${JSON.stringify(input.shape)}; expected [1, ${MOVENET_INPUT_SIZE}, ${MOVENET_INPUT_SIZE}, 3]. Run "npm run model" to get the right file.`
  }
  if (!['uint8', 'float32', 'int32'].includes(input.dataType)) {
    return `The pose model wants ${input.dataType} input, which is not supported.`
  }
  if (output.dataType !== 'float32' || output.shape[output.shape.length - 2] !== 17 || output.shape[output.shape.length - 1] !== 3) {
    return `Unexpected pose model output ${output.dataType} ${JSON.stringify(output.shape)}; expected float32 [1, 1, 17, 3].`
  }
  return null
}

/**
 * The resizer always gives us 8-bit RGB. MoveNet models want that as uint8, or as float32 or
 * int32 holding the same 0..255 values, depending on the build, so convert when needed.
 * Runs on the camera thread.
 */
export function inputBufferFor(pixels: ArrayBuffer, dataType: string): ArrayBuffer {
  'worklet'
  if (dataType === 'uint8') return pixels
  const bytes = new Uint8Array(pixels)
  if (dataType === 'float32') {
    const out = new Float32Array(bytes.length)
    for (let i = 0; i < bytes.length; i++) out[i] = bytes[i]
    return out.buffer
  }
  if (dataType === 'int32') {
    const out = new Int32Array(bytes.length)
    for (let i = 0; i < bytes.length; i++) out[i] = bytes[i]
    return out.buffer
  }
  throw new Error(`Unsupported pose model input type: ${dataType}`)
}

/** The 51 numbers of a MoveNet output as a plain array, which can be sent from the camera thread to JS. */
export function outputToArray(output: ArrayBuffer): number[] {
  'worklet'
  return Array.from(new Float32Array(output))
}

export function poseFromOutput(raw: readonly number[]): Pose {
  return parseMoveNetOutput(raw)
}
