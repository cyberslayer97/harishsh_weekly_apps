import {
  DEFAULT_MIN_SCORE,
  normalizePose,
  poseDistance,
  type NormalizedPose,
} from './features'
import type { Pose } from './keypoints'

export interface DetectorConfig {
  /** Keypoints below this confidence are ignored. */
  minScore: number
  /** Distance (in torso lengths) from the last captured pose that counts as a new pose. */
  changeThreshold: number
  /** How far (in torso lengths) the pose may wander while still counting as held still. */
  stillThreshold: number
  /** How long the pose must be held still before a photo is taken. */
  holdMs: number
  /** Minimum time between two photos. */
  cooldownMs: number
  /** A longer gap between frames than this (app backgrounded, camera stalled) ends any hold in progress. */
  maxFrameGapMs: number
}

export const DEFAULT_CONFIG: DetectorConfig = {
  minScore: DEFAULT_MIN_SCORE,
  changeThreshold: 0.25,
  stillThreshold: 0.12,
  holdMs: 400,
  cooldownMs: 1500,
  maxFrameGapMs: 300,
}

/** `base` with the defined values of `partial` on top; an explicit `undefined` never wipes a value. */
export function mergeConfig(
  base: DetectorConfig,
  partial: Partial<DetectorConfig> = {}
): DetectorConfig {
  const merged = { ...base }
  for (const key of Object.keys(partial) as (keyof DetectorConfig)[]) {
    const value = partial[key]
    if (value !== undefined) merged[key] = value
  }
  return merged
}

/** Share of the hold time after which we call it 'holding' rather than 'moving', so the status doesn't flicker. */
const HOLDING_MIN_PROGRESS = 0.25

export type DetectorStatus =
  /** No usable pose in the frame. */
  | 'no-pose'
  /** Too few joints in common with the last photo to compare. */
  | 'unsure'
  /** Same pose as the last photo. */
  | 'same-pose'
  /** A new pose, but the person is still moving. */
  | 'moving'
  /** A new pose and the person is holding still; a photo is coming. */
  | 'holding'
  /** A photo was taken too recently. */
  | 'cooldown'
  /** A photo should be taken now. */
  | 'captured'

export interface DetectorResult {
  /** True on the single frame where a photo should be taken. */
  capture: boolean
  /** 0..1, how close the current hold is to triggering a photo. Drives the on-screen ring. */
  holdProgress: number
  /** Distance from the last captured pose, or null when there is none yet or it can't be compared. */
  changeScore: number | null
  status: DetectorStatus
}

/**
 * Decides, frame by frame, when the person has struck a new pose and held it
 * long enough to take a photo.
 *
 * A photo is taken when all of these are true:
 *  - the pose differs from the last captured pose by at least `changeThreshold`
 *    (or no photo has been taken yet),
 *  - the pose has stayed within `stillThreshold` of where it was for `holdMs`,
 *  - `cooldownMs` has passed since the last photo. The hold keeps timing
 *    during the cooldown, so a pose already held when it ends is taken at once.
 *
 * Known limits, to tune with real footage: leaning towards the camera shrinks
 * the torso and scales every distance, and a joint that drops out of view is
 * skipped rather than counted as a change.
 *
 * Pure and deterministic: time comes from the `nowMs` argument.
 */
export class PoseChangeDetector {
  private config: DetectorConfig
  private anchor: NormalizedPose | null = null
  private lastCaptureAt = Number.NEGATIVE_INFINITY
  /** What `anchor` and `lastCaptureAt` were before the latest capture, so it can be undone. */
  private beforeCapture: { anchor: NormalizedPose | null; at: number } | null = null
  private lastFrameAt = Number.NEGATIVE_INFINITY
  /** The pose when the current hold started, and when. */
  private holdPose: NormalizedPose | null = null
  private holdStartedAt = 0

  constructor(config: Partial<DetectorConfig> = {}) {
    this.config = mergeConfig(DEFAULT_CONFIG, config)
  }

  setConfig(config: Partial<DetectorConfig>): void {
    this.config = mergeConfig(this.config, config)
  }

  /** Forgets the last photo and any hold in progress, e.g. when a new session starts. */
  reset(): void {
    this.anchor = null
    this.lastCaptureAt = Number.NEGATIVE_INFINITY
    this.beforeCapture = null
    this.lastFrameAt = Number.NEGATIVE_INFINITY
    this.holdPose = null
    this.holdStartedAt = 0
  }

  /**
   * Takes back the capture just reported, for when the photo could not be taken: the pose counts
   * as not yet photographed again, and the cooldown starts from `nowMs` so a failing camera is
   * retried at the cooldown rate, not on every frame.
   */
  undoCapture(nowMs: number): void {
    if (this.beforeCapture == null) return
    this.anchor = this.beforeCapture.anchor
    this.lastCaptureAt = nowMs
    this.beforeCapture = null
  }

  update(pose: Pose | null, nowMs: number): DetectorResult {
    // A stall in the frame stream means we did not see the pose being held.
    if (nowMs - this.lastFrameAt > this.config.maxFrameGapMs) this.holdPose = null
    this.lastFrameAt = nowMs

    const current = pose == null ? null : normalizePose(pose, this.config.minScore)
    if (current == null) {
      this.holdPose = null
      return { capture: false, holdProgress: 0, changeScore: null, status: 'no-pose' }
    }

    // Track how long the pose has been held still, measured against where the
    // hold began so that slow drift can't pass as stillness.
    const drift = this.holdPose == null ? null : poseDistance(this.holdPose, current)
    if (drift == null || drift > this.config.stillThreshold) {
      this.holdPose = current
      this.holdStartedAt = nowMs
    }
    const heldMs = nowMs - this.holdStartedAt

    const changeScore = this.anchor == null ? null : poseDistance(this.anchor, current)
    if (this.anchor != null && changeScore == null) {
      return { capture: false, holdProgress: 0, changeScore, status: 'unsure' }
    }
    if (changeScore != null && changeScore < this.config.changeThreshold) {
      return { capture: false, holdProgress: 0, changeScore, status: 'same-pose' }
    }

    // A new pose is pending.
    const holdProgress = Math.min(1, heldMs / this.config.holdMs)
    if (nowMs - this.lastCaptureAt < this.config.cooldownMs) {
      return { capture: false, holdProgress: 0, changeScore, status: 'cooldown' }
    }
    if (heldMs < this.config.holdMs) {
      return {
        capture: false,
        holdProgress,
        changeScore,
        status: holdProgress < HOLDING_MIN_PROGRESS ? 'moving' : 'holding',
      }
    }

    this.beforeCapture = { anchor: this.anchor, at: this.lastCaptureAt }
    this.anchor = current
    this.lastCaptureAt = nowMs
    return { capture: true, holdProgress: 1, changeScore, status: 'captured' }
  }
}
