import { useCallback, useEffect, useRef } from 'react'
import { scheduleOnRN } from 'react-native-worklets'
import { useFrameOutput, type CameraFrameOutput, type Frame } from 'react-native-vision-camera'
import { useResizer } from 'react-native-vision-camera-resizer'
import { useTensorflowModel } from 'react-native-fast-tflite'
import { MOVENET_INPUT_SIZE, inputBufferFor, outputToArray, validateModel } from './tensor'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MOVENET_MODEL = require('../../assets/models/movenet_lightning.tflite')

export interface PoseStream {
  /** Add this to the camera's outputs. */
  frameOutput: CameraFrameOutput
  ready: boolean
  /** A message for the user when the model could not be loaded or is the wrong file. */
  error: string | null
}

/**
 * Runs the pose model on every camera frame and calls `onKeypoints` with the 51 raw numbers
 * (y, x, score for each of 17 joints) on the JS thread. While `active` is false the frames are
 * dropped without running the model.
 */
export function usePoseStream(onKeypoints: (raw: number[]) => void, active: boolean): PoseStream {
  const modelState = useTensorflowModel(MOVENET_MODEL, [])
  const model = modelState.state === 'loaded' ? modelState.model : undefined
  const { resizer, error: resizerError } = useResizer({
    width: MOVENET_INPUT_SIZE,
    height: MOVENET_INPUT_SIZE,
    channelOrder: 'rgb',
    dataType: 'uint8',
    // Pad to a square instead of cropping, so a tall frame keeps head and feet in view.
    // The resizer also applies the frame's rotation and mirroring, so the model sees an upright image.
    scaleMode: 'contain',
    pixelLayout: 'interleaved',
  })

  const modelError = model != null ? validateModel(model.inputs, model.outputs) : null
  const inputType = model?.inputs[0]?.dataType

  // A stable function the camera thread can call to reach the latest handler.
  const latest = useRef(onKeypoints)
  useEffect(() => {
    latest.current = onKeypoints
  }, [onKeypoints])
  const deliver = useCallback((raw: number[]) => latest.current(raw), [])

  const ready = model != null && resizer != null && inputType != null && modelError == null
  const usable = ready && active

  const onFrame = useCallback(
    (frame: Frame) => {
      'worklet'
      try {
        if (!usable) return
        const resized = resizer.resize(frame)
        try {
          const input = inputBufferFor(resized.getPixelBuffer(), inputType)
          const outputs = model.runSync([input])
          scheduleOnRN(deliver, outputToArray(outputs[0]))
        } finally {
          resized.dispose()
        }
      } finally {
        frame.dispose()
      }
    },
    [usable, resizer, model, inputType, deliver]
  )

  const frameOutput = useFrameOutput({
    pixelFormat: 'yuv',
    dropFramesWhileBusy: true,
    onFrame,
  })

  const error =
    modelState.state === 'error'
      ? 'The pose model could not be loaded. Run "npm run model" and rebuild the app.'
      : modelError ?? (resizerError != null ? `Image resizer failed: ${resizerError.message}` : null)

  return { frameOutput, ready, error }
}
