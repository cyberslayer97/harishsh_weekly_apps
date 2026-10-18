/** MoveNet / COCO 17-keypoint layout. */
export const KP = {
  nose: 0,
  leftEye: 1,
  rightEye: 2,
  leftEar: 3,
  rightEar: 4,
  leftShoulder: 5,
  rightShoulder: 6,
  leftElbow: 7,
  rightElbow: 8,
  leftWrist: 9,
  rightWrist: 10,
  leftHip: 11,
  rightHip: 12,
  leftKnee: 13,
  rightKnee: 14,
  leftAnkle: 15,
  rightAnkle: 16,
} as const

export const KEYPOINT_COUNT = 17

/** x and y are normalized image coordinates (0..1); score is the model confidence (0..1). */
export interface Keypoint {
  x: number
  y: number
  score: number
}

export type Pose = readonly Keypoint[]

/**
 * Converts the raw MoveNet single-pose output, `[y, x, score]` for each of the
 * 17 keypoints (51 numbers), into a Pose.
 *
 * `aspect` is width / height of the image region the model was given. The model
 * reports x and y as fractions of that region's width and height, so for a
 * region that is not square x is rescaled to the same unit as y. That keeps
 * distances the same in every direction.
 */
export function parseMoveNetOutput(output: ArrayLike<number>, aspect = 1): Pose {
  if (output.length < KEYPOINT_COUNT * 3) {
    throw new Error(
      `Expected ${KEYPOINT_COUNT * 3} values from the pose model, got ${output.length}`
    )
  }
  const pose: Keypoint[] = []
  for (let i = 0; i < KEYPOINT_COUNT; i++) {
    pose.push({
      y: output[i * 3],
      x: output[i * 3 + 1] * aspect,
      score: output[i * 3 + 2],
    })
  }
  return pose
}
