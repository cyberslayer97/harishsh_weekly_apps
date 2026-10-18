import { normalizePose, poseDistance } from '../features'
import { KEYPOINT_COUNT, KP, parseMoveNetOutput } from '../keypoints'
import { ARM_RAISED, BOTH_ARMS_UP, toPose } from './fixtures'

describe('parseMoveNetOutput', () => {
  it('reads [y, x, score] triples', () => {
    const raw = new Float32Array(KEYPOINT_COUNT * 3)
    raw.set([0.25, 0.5, 0.75], KP.leftWrist * 3)
    const pose = parseMoveNetOutput(raw)
    expect(pose).toHaveLength(KEYPOINT_COUNT)
    expect(pose[KP.leftWrist]).toEqual({ y: 0.25, x: 0.5, score: 0.75 })
  })

  it('rescales x by the aspect ratio of the region the model saw', () => {
    const raw = new Float32Array(KEYPOINT_COUNT * 3)
    raw.set([0.5, 0.5, 0.9], KP.nose * 3)
    expect(parseMoveNetOutput(raw, 0.5)[KP.nose].x).toBeCloseTo(0.25, 10)
    expect(parseMoveNetOutput(raw)[KP.nose].x).toBeCloseTo(0.5, 10)
  })

  it('rejects output that is too short', () => {
    expect(() => parseMoveNetOutput(new Float32Array(10))).toThrow(/Expected 51/)
  })
})

describe('normalizePose', () => {
  const dist = (a: ReturnType<typeof toPose>, b: ReturnType<typeof toPose>) =>
    poseDistance(normalizePose(a)!, normalizePose(b)!)!

  it('ignores where the person stands in the frame', () => {
    expect(dist(toPose(ARM_RAISED), toPose(ARM_RAISED, { shift: [0.1, 0.05] }))).toBeCloseTo(0, 6)
  })

  it('ignores how far the person is from the camera', () => {
    expect(dist(toPose(ARM_RAISED), toPose(ARM_RAISED, { scale: 0.7 }))).toBeCloseTo(0, 6)
  })

  it('returns null when a hip is not visible', () => {
    const pose = toPose(ARM_RAISED)
    pose[KP.leftHip] = { ...pose[KP.leftHip], score: 0.1 }
    expect(normalizePose(pose)).toBeNull()
  })

  it('returns null when the person is too far away to measure', () => {
    expect(normalizePose(toPose(ARM_RAISED, { scale: 0.1 }))).toBeNull()
  })

  it('returns null for a pose of the wrong length', () => {
    expect(normalizePose(toPose(ARM_RAISED).slice(0, 10))).toBeNull()
  })

  it('leaves out a joint that is not visible', () => {
    const pose = toPose(ARM_RAISED)
    pose[KP.leftWrist] = { ...pose[KP.leftWrist], score: 0 }
    expect(normalizePose(pose)![KP.leftWrist]).toBeNull()
  })

  it('does not use eyes and ears', () => {
    const n = normalizePose(toPose(ARM_RAISED))!
    for (const i of [KP.leftEye, KP.rightEye, KP.leftEar, KP.rightEar]) expect(n[i]).toBeNull()
  })
})

describe('poseDistance', () => {
  it('is symmetric and zero for identical poses', () => {
    const a = normalizePose(toPose(ARM_RAISED))!
    const b = normalizePose(toPose(BOTH_ARMS_UP))!
    expect(poseDistance(a, a)).toBe(0)
    expect(poseDistance(a, b)).toBeCloseTo(poseDistance(b, a)!, 10)
    expect(poseDistance(a, b)!).toBeGreaterThan(0.4)
  })

  it('is null when too few joints are visible in both', () => {
    const full = normalizePose(toPose(ARM_RAISED))!
    const partial = toPose(ARM_RAISED).map((k, i) =>
      [KP.leftShoulder, KP.rightShoulder, KP.leftHip, KP.rightHip].includes(i as never) ? k : { ...k, score: 0 }
    )
    expect(poseDistance(full, normalizePose(partial)!)).toBeNull()
  })
})
