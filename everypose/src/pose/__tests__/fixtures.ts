import { KEYPOINT_COUNT, KP, type Keypoint, type Pose } from '../keypoints'

/** Same joint order and coordinates as the poses in design/ui-mockups.html (a 200 x 300 box). */
type Joints = {
  head: [number, number]
  /** L shoulder, R shoulder, L elbow, R elbow, L wrist, R wrist, L hip, R hip, L knee, R knee, L ankle, R ankle */
  j: [number, number][]
}

const BOX = 300

export const ARM_RAISED: Joints = {
  head: [100, 40],
  j: [[75, 80], [125, 80], [55, 120], [150, 60], [45, 160], [165, 25], [85, 170], [115, 170], [80, 225], [122, 215], [78, 280], [135, 262]],
}
export const BOTH_ARMS_UP: Joints = {
  head: [100, 40],
  j: [[75, 80], [125, 80], [55, 50], [145, 50], [50, 15], [150, 15], [85, 170], [115, 170], [82, 225], [118, 225], [80, 280], [120, 280]],
}
export const T_POSE: Joints = {
  head: [100, 40],
  j: [[75, 80], [125, 80], [40, 82], [160, 82], [8, 82], [192, 82], [85, 170], [115, 170], [70, 225], [130, 225], [60, 280], [140, 280]],
}

/** Builds a full 17-keypoint pose. `shift` moves the person in the frame; `scale` moves them closer or further away. */
export function toPose(
  joints: Joints,
  opts: { shift?: [number, number]; scale?: number; score?: number } = {}
): Keypoint[] {
  const { shift = [0, 0], scale = 1, score = 0.9 } = opts
  const pt = ([x, y]: [number, number]): Keypoint => ({
    x: 0.17 + (x / BOX) * scale + shift[0],
    y: (y / BOX) * scale + shift[1],
    score,
  })
  const pose: Keypoint[] = new Array(KEYPOINT_COUNT)
  const head = pt(joints.head)
  for (const i of [KP.nose, KP.leftEye, KP.rightEye, KP.leftEar, KP.rightEar]) pose[i] = head
  const order = [
    KP.leftShoulder, KP.rightShoulder, KP.leftElbow, KP.rightElbow, KP.leftWrist, KP.rightWrist,
    KP.leftHip, KP.rightHip, KP.leftKnee, KP.rightKnee, KP.leftAnkle, KP.rightAnkle,
  ]
  order.forEach((idx, n) => (pose[idx] = pt(joints.j[n])))
  return pose
}

/** Returns a copy of the pose with the given joint moved by (dx, dy), in frame coordinates. */
export function withJointMoved(pose: Pose, joint: number, dx: number, dy: number): Keypoint[] {
  return pose.map((k, i) => (i === joint ? { ...k, x: k.x + dx, y: k.y + dy } : k))
}

/** Deterministic pseudo-random noise in [-amp, amp], so tests never flake. */
export function makeNoise(seed: number): (amp: number) => number {
  let s = seed >>> 0
  return (amp) => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return ((s / 0xffffffff) * 2 - 1) * amp
  }
}

export function jitter(pose: Pose, noise: (amp: number) => number, amp: number): Keypoint[] {
  return pose.map((k) => ({ ...k, x: k.x + noise(amp), y: k.y + noise(amp) }))
}

/** Linear blend between two poses, for simulating a person moving from one to the other. */
export function blend(a: Pose, b: Pose, t: number): Keypoint[] {
  return a.map((k, i) => ({
    x: k.x + (b[i].x - k.x) * t,
    y: k.y + (b[i].y - k.y) * t,
    score: Math.min(k.score, b[i].score),
  }))
}
