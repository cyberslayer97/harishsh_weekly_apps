import { DEFAULT_CONFIG, PoseChangeDetector, type DetectorResult } from '../detector'
import { KP, type Pose } from '../keypoints'
import { configForSensitivity, CHANGE_THRESHOLDS, type Sensitivity } from '../presets'
import { ARM_RAISED, BOTH_ARMS_UP, T_POSE, blend, jitter, makeNoise, toPose, withJointMoved } from './fixtures'

const FRAME_MS = 33

interface Frame extends DetectorResult {
  t: number
}

/** Feeds the detector one frame every ~30 fps from startMs for durationMs. */
function feed(
  det: PoseChangeDetector,
  poseAt: (elapsedMs: number) => Pose | null,
  startMs: number,
  durationMs: number
): Frame[] {
  const out: Frame[] = []
  for (let e = 0; e <= durationMs; e += FRAME_MS) {
    out.push({ t: startMs + e, ...det.update(poseAt(e), startMs + e) })
  }
  return out
}

const captures = (frames: Frame[]) => frames.filter((f) => f.capture)

const A = toPose(ARM_RAISED)
const B = toPose(BOTH_ARMS_UP)
const T = toPose(T_POSE)

describe('PoseChangeDetector', () => {
  it('takes the first photo once the pose has been held for holdMs', () => {
    const det = new PoseChangeDetector()
    const frames = feed(det, () => A, 0, 1000)
    const shots = captures(frames)
    expect(shots).toHaveLength(1)
    expect(shots[0].t).toBeGreaterThanOrEqual(DEFAULT_CONFIG.holdMs)
    expect(shots[0].t).toBeLessThan(DEFAULT_CONFIG.holdMs + FRAME_MS)
    expect(shots[0].status).toBe('captured')
  })

  it('does not take another photo while the same pose is held', () => {
    const det = new PoseChangeDetector()
    const frames = feed(det, () => A, 0, 10_000)
    expect(captures(frames)).toHaveLength(1)
    expect(frames[frames.length - 1].status).toBe('same-pose')
  })

  it('takes a photo for a new pose only once it is held, not while moving', () => {
    const det = new PoseChangeDetector({ cooldownMs: 0 })
    feed(det, () => A, 0, 1000)
    const moveMs = 600
    const moving = feed(det, (e) => blend(A, B, Math.min(e / moveMs, 1)), 1033, moveMs + 1500)
    const shots = captures(moving)
    expect(shots).toHaveLength(1)
    // no photo while the person is moving; it comes once they have arrived
    expect(shots[0].t).toBeGreaterThan(1033 + moveMs)
    const during = moving.filter((f) => f.t <= 1033 + moveMs)
    expect(during.some((f) => f.status === 'moving' || f.status === 'holding')).toBe(true)
    expect(during.some((f) => f.capture)).toBe(false)
  })

  it('ignores keypoint jitter', () => {
    const det = new PoseChangeDetector()
    const noise = makeNoise(7)
    const frames = feed(det, () => jitter(A, noise, 0.01), 0, 5000)
    expect(captures(frames)).toHaveLength(1)
  })

  it('ignores the person moving across or towards the camera in the same pose', () => {
    const det = new PoseChangeDetector()
    feed(det, () => A, 0, 1000)
    const frames = feed(det, () => toPose(ARM_RAISED, { shift: [0.1, 0.05], scale: 0.8 }), 1033, 2000)
    expect(captures(frames)).toHaveLength(0)
  })

  it('waits out the cooldown before the next photo', () => {
    const det = new PoseChangeDetector({ holdMs: 400, cooldownMs: 1500 })
    const first = feed(det, () => A, 0, 500)
    const firstAt = captures(first)[0].t
    // a new pose that is held long before the cooldown is over
    const next = feed(det, (e) => blend(A, B, Math.min(e / 200, 1)), 533, 2500)
    const second = captures(next)[0]
    expect(second.t - firstAt).toBeGreaterThanOrEqual(1500)
    const waiting = next.filter((f) => f.t < firstAt + 1500 && f.t > 533 + 200 + 400)
    expect(waiting.length).toBeGreaterThan(0)
    for (const f of waiting) {
      expect(f.status).toBe('cooldown')
      expect(f.holdProgress).toBe(0)
    }
  })

  it('restarts the hold when the pose disappears for a moment', () => {
    const det = new PoseChangeDetector()
    feed(det, () => A, 0, 300)
    expect(det.update(null, 333).status).toBe('no-pose')
    const frames = feed(det, () => A, 366, 1000)
    expect(captures(frames)[0].t).toBeGreaterThanOrEqual(366 + DEFAULT_CONFIG.holdMs)
  })

  it('treats a pose with an unseen torso as no pose', () => {
    const det = new PoseChangeDetector()
    const lost = A.map((k, i) => (i === KP.rightShoulder ? { ...k, score: 0.05 } : k))
    const r = det.update(lost, 0)
    expect(r).toEqual({ capture: false, holdProgress: 0, changeScore: null, status: 'no-pose' })
  })

  it('is unsure, and takes no photo, when too few joints can be compared', () => {
    const det = new PoseChangeDetector()
    feed(det, () => A, 0, 1000)
    const torsoOnly = A.map((k, i) =>
      [KP.leftShoulder, KP.rightShoulder, KP.leftHip, KP.rightHip].includes(i as never) ? k : { ...k, score: 0 }
    )
    const frames = feed(det, () => torsoOnly, 1033, 2000)
    expect(captures(frames)).toHaveLength(0)
    expect(frames[frames.length - 1].status).toBe('unsure')
  })

  it('reports hold progress rising from 0 to 1 for a pending pose', () => {
    const det = new PoseChangeDetector()
    const frames = feed(det, () => A, 0, 600)
    const shotIndex = frames.findIndex((f) => f.capture)
    const progress = frames.slice(0, shotIndex + 1).map((f) => f.holdProgress)
    expect(progress[0]).toBe(0)
    expect(frames[0].status).toBe('moving')
    for (let i = 1; i < progress.length; i++) expect(progress[i]).toBeGreaterThanOrEqual(progress[i - 1])
    expect(progress.find((p) => p > 0 && p < 1)).toBeDefined()
    expect(progress[progress.length - 1]).toBe(1)
  })

  it('reports no progress while the pose is the same as the last photo', () => {
    const det = new PoseChangeDetector()
    feed(det, () => A, 0, 1000)
    const frames = feed(det, () => A, 1033, 1000)
    expect(frames.every((f) => f.holdProgress === 0 && f.capture === false)).toBe(true)
  })

  it('forgets the last photo on reset(), even if the clock starts over', () => {
    const det = new PoseChangeDetector({ cooldownMs: 0 })
    expect(captures(feed(det, () => A, 0, 1000))).toHaveLength(1)
    det.reset()
    expect(captures(feed(det, () => A, 0, 1000))).toHaveLength(1)
  })

  it('does not count a stall in the frame stream as time held', () => {
    const det = new PoseChangeDetector({ cooldownMs: 0 })
    feed(det, () => A, 0, 200)
    // the camera stalls for 5 s, then the same pose is still there
    const r = det.update(A, 5200)
    expect(r.capture).toBe(false)
    const frames = feed(det, () => A, 5233, 1000)
    expect(captures(frames)[0].t).toBeGreaterThanOrEqual(5200 + DEFAULT_CONFIG.holdMs)
  })

  it('ignores an explicit undefined in the config', () => {
    const det = new PoseChangeDetector({ holdMs: undefined, changeThreshold: undefined })
    const frames = feed(det, () => A, 0, 3000)
    expect(captures(frames)).toHaveLength(1)
  })

  it('says moving until the hold is well under way, then holding', () => {
    const det = new PoseChangeDetector()
    const frames = feed(det, () => A, 0, 380)
    const statuses = frames.map((f) => f.status)
    expect(statuses[0]).toBe('moving')
    expect(statuses[1]).toBe('moving') // one frame in is not yet a hold
    expect(statuses[statuses.length - 1]).toBe('holding')
    const firstHolding = statuses.indexOf('holding')
    expect(statuses.slice(firstHolding).every((st) => st === 'holding')).toBe(true)
  })

  it('applies a new config from setConfig()', () => {
    const det = new PoseChangeDetector({ holdMs: 400 })
    det.setConfig({ holdMs: 900 })
    const shots = captures(feed(det, () => A, 0, 2000))
    expect(shots[0].t).toBeGreaterThanOrEqual(900)
  })

  describe('sensitivity', () => {
    // Held pose A, then a change of a given size, held.
    const moveBothWrists = (dx: number): Pose =>
      withJointMoved(withJointMoved(A, KP.leftWrist, -dx, 0), KP.rightWrist, dx, 0)

    const photosAfterChange = (level: Sensitivity, changed: Pose): number => {
      const det = new PoseChangeDetector(configForSensitivity(level, { cooldownMs: 0 }))
      feed(det, () => A, 0, 1000)
      return captures(feed(det, () => changed, 1033, 1500)).length
    }

    it('a small change is a new pose only at high sensitivity', () => {
      const small = moveBothWrists(0.15) // about 0.2 torso lengths away
      expect(photosAfterChange('low', small)).toBe(0)
      expect(photosAfterChange('medium', small)).toBe(0)
      expect(photosAfterChange('high', small)).toBe(1)
    })

    it('a medium change is a new pose at medium and high sensitivity', () => {
      expect(photosAfterChange('low', T)).toBe(0)
      expect(photosAfterChange('medium', T)).toBe(1)
      expect(photosAfterChange('high', T)).toBe(1)
    })

    it('a big change is a new pose at every sensitivity', () => {
      for (const level of ['low', 'medium', 'high'] as const) {
        expect(photosAfterChange(level, B)).toBe(1)
      }
    })

    it('every change threshold is above the stillness threshold', () => {
      for (const t of Object.values(CHANGE_THRESHOLDS)) expect(t).toBeGreaterThan(DEFAULT_CONFIG.stillThreshold)
    })
  })
})
