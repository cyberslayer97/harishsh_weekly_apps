import { KEYPOINT_COUNT, KP, type Pose } from './keypoints'

export interface Point {
  x: number
  y: number
}

/** One entry per keypoint index; null where the joint is not used or not visible. */
export type NormalizedPose = readonly (Point | null)[]

/**
 * Joints that take part in the comparison. Eyes and ears are left out: they are
 * noisy and add little beyond the nose for telling poses apart.
 */
export const BODY_JOINTS: readonly number[] = [
  KP.nose,
  KP.leftShoulder,
  KP.rightShoulder,
  KP.leftElbow,
  KP.rightElbow,
  KP.leftWrist,
  KP.rightWrist,
  KP.leftHip,
  KP.rightHip,
  KP.leftKnee,
  KP.rightKnee,
  KP.leftAnkle,
  KP.rightAnkle,
]

export const DEFAULT_MIN_SCORE = 0.3
/** Smallest torso length, as a fraction of the frame, that we trust. Smaller means the person is too far away. */
export const MIN_TORSO_LENGTH = 0.05
/** Joints that both poses must have for a distance to be meaningful. */
export const MIN_SHARED_JOINTS = 8

/**
 * Makes a pose independent of where the person stands and how far from the
 * camera they are: the origin is the mid-hip point and the unit is the torso
 * length (mid-shoulder to mid-hip).
 *
 * Assumes isotropic coordinates (the same scale on x and y), which holds when the
 * model input is a cropped square of the frame.
 *
 * Returns null when both shoulders and both hips are not visible, because the
 * torso is the reference for everything else.
 */
export function normalizePose(
  pose: Pose,
  minScore: number = DEFAULT_MIN_SCORE
): NormalizedPose | null {
  if (pose.length !== KEYPOINT_COUNT) return null

  const visible = (i: number): boolean => {
    const k = pose[i]
    return k.score >= minScore && Number.isFinite(k.x) && Number.isFinite(k.y)
  }
  if (
    !visible(KP.leftShoulder) ||
    !visible(KP.rightShoulder) ||
    !visible(KP.leftHip) ||
    !visible(KP.rightHip)
  ) {
    return null
  }

  const shoulder = mid(pose[KP.leftShoulder], pose[KP.rightShoulder])
  const hip = mid(pose[KP.leftHip], pose[KP.rightHip])
  const torso = Math.hypot(shoulder.x - hip.x, shoulder.y - hip.y)
  if (torso < MIN_TORSO_LENGTH) return null

  const out: (Point | null)[] = new Array(KEYPOINT_COUNT).fill(null)
  for (const i of BODY_JOINTS) {
    if (!visible(i)) continue
    out[i] = { x: (pose[i].x - hip.x) / torso, y: (pose[i].y - hip.y) / torso }
  }
  return out
}

/**
 * Root-mean-square distance, in torso lengths, over the joints visible in both
 * poses. RMS (not the plain mean) so that one limb moving a long way counts
 * for more than many joints moving a little, which is what jitter looks like.
 *
 * Returns null when fewer than `minShared` joints are visible in both.
 */
export function poseDistance(
  a: NormalizedPose,
  b: NormalizedPose,
  minShared: number = MIN_SHARED_JOINTS
): number | null {
  let sum = 0
  let shared = 0
  for (const i of BODY_JOINTS) {
    const p = a[i]
    const q = b[i]
    if (p == null || q == null) continue
    const dx = p.x - q.x
    const dy = p.y - q.y
    sum += dx * dx + dy * dy
    shared++
  }
  if (shared < minShared) return null
  return Math.sqrt(sum / shared)
}

function mid(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}
