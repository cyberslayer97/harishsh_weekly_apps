var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/pose/keypoints.ts
var KP = {
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
  rightAnkle: 16
};
var KEYPOINT_COUNT = 17;
function parseMoveNetOutput(output, aspect = 1) {
  if (output.length < KEYPOINT_COUNT * 3) {
    throw new Error(
      `Expected ${KEYPOINT_COUNT * 3} values from the pose model, got ${output.length}`
    );
  }
  const pose = [];
  for (let i = 0; i < KEYPOINT_COUNT; i++) {
    pose.push({
      y: output[i * 3],
      x: output[i * 3 + 1] * aspect,
      score: output[i * 3 + 2]
    });
  }
  return pose;
}

// src/pose/features.ts
var BODY_JOINTS = [
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
  KP.rightAnkle
];
var DEFAULT_MIN_SCORE = 0.3;
var MIN_TORSO_LENGTH = 0.05;
var MIN_SHARED_JOINTS = 8;
function normalizePose(pose, minScore = DEFAULT_MIN_SCORE) {
  if (pose.length !== KEYPOINT_COUNT) return null;
  const visible = (i) => {
    const k = pose[i];
    return k.score >= minScore && Number.isFinite(k.x) && Number.isFinite(k.y);
  };
  if (!visible(KP.leftShoulder) || !visible(KP.rightShoulder) || !visible(KP.leftHip) || !visible(KP.rightHip)) {
    return null;
  }
  const shoulder = mid(pose[KP.leftShoulder], pose[KP.rightShoulder]);
  const hip = mid(pose[KP.leftHip], pose[KP.rightHip]);
  const torso = Math.hypot(shoulder.x - hip.x, shoulder.y - hip.y);
  if (torso < MIN_TORSO_LENGTH) return null;
  const out = new Array(KEYPOINT_COUNT).fill(null);
  for (const i of BODY_JOINTS) {
    if (!visible(i)) continue;
    out[i] = { x: (pose[i].x - hip.x) / torso, y: (pose[i].y - hip.y) / torso };
  }
  return out;
}
function poseDistance(a, b, minShared = MIN_SHARED_JOINTS) {
  let sum = 0;
  let shared = 0;
  for (const i of BODY_JOINTS) {
    const p = a[i];
    const q = b[i];
    if (p == null || q == null) continue;
    const dx = p.x - q.x;
    const dy = p.y - q.y;
    sum += dx * dx + dy * dy;
    shared++;
  }
  if (shared < minShared) return null;
  return Math.sqrt(sum / shared);
}
function mid(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// src/pose/detector.ts
var DEFAULT_CONFIG = {
  minScore: DEFAULT_MIN_SCORE,
  changeThreshold: 0.25,
  stillThreshold: 0.12,
  holdMs: 400,
  cooldownMs: 1500,
  maxFrameGapMs: 300
};
function mergeConfig(base, partial = {}) {
  const merged = { ...base };
  for (const key of Object.keys(partial)) {
    const value = partial[key];
    if (value !== void 0) merged[key] = value;
  }
  return merged;
}
var HOLDING_MIN_PROGRESS = 0.25;
var PoseChangeDetector = class {
  constructor(config = {}) {
    __publicField(this, "config");
    __publicField(this, "anchor", null);
    __publicField(this, "lastCaptureAt", Number.NEGATIVE_INFINITY);
    /** What `anchor` and `lastCaptureAt` were before the latest capture, so it can be undone. */
    __publicField(this, "beforeCapture", null);
    __publicField(this, "lastFrameAt", Number.NEGATIVE_INFINITY);
    /** The pose when the current hold started, and when. */
    __publicField(this, "holdPose", null);
    __publicField(this, "holdStartedAt", 0);
    this.config = mergeConfig(DEFAULT_CONFIG, config);
  }
  setConfig(config) {
    this.config = mergeConfig(this.config, config);
  }
  /** Forgets the last photo and any hold in progress, e.g. when a new session starts. */
  reset() {
    this.anchor = null;
    this.lastCaptureAt = Number.NEGATIVE_INFINITY;
    this.beforeCapture = null;
    this.lastFrameAt = Number.NEGATIVE_INFINITY;
    this.holdPose = null;
    this.holdStartedAt = 0;
  }
  /**
   * Takes back the capture just reported, for when the photo could not be taken: the pose counts
   * as not yet photographed again, and the cooldown starts from `nowMs` so a failing camera is
   * retried at the cooldown rate, not on every frame.
   */
  undoCapture(nowMs) {
    if (this.beforeCapture == null) return;
    this.anchor = this.beforeCapture.anchor;
    this.lastCaptureAt = nowMs;
    this.beforeCapture = null;
  }
  update(pose, nowMs) {
    if (nowMs - this.lastFrameAt > this.config.maxFrameGapMs) this.holdPose = null;
    this.lastFrameAt = nowMs;
    const current = pose == null ? null : normalizePose(pose, this.config.minScore);
    if (current == null) {
      this.holdPose = null;
      return { capture: false, holdProgress: 0, changeScore: null, status: "no-pose" };
    }
    const drift = this.holdPose == null ? null : poseDistance(this.holdPose, current);
    if (drift == null || drift > this.config.stillThreshold) {
      this.holdPose = current;
      this.holdStartedAt = nowMs;
    }
    const heldMs = nowMs - this.holdStartedAt;
    const changeScore = this.anchor == null ? null : poseDistance(this.anchor, current);
    if (this.anchor != null && changeScore == null) {
      return { capture: false, holdProgress: 0, changeScore, status: "unsure" };
    }
    if (changeScore != null && changeScore < this.config.changeThreshold) {
      return { capture: false, holdProgress: 0, changeScore, status: "same-pose" };
    }
    const holdProgress = Math.min(1, heldMs / this.config.holdMs);
    if (nowMs - this.lastCaptureAt < this.config.cooldownMs) {
      return { capture: false, holdProgress: 0, changeScore, status: "cooldown" };
    }
    if (heldMs < this.config.holdMs) {
      return {
        capture: false,
        holdProgress,
        changeScore,
        status: holdProgress < HOLDING_MIN_PROGRESS ? "moving" : "holding"
      };
    }
    this.beforeCapture = { anchor: this.anchor, at: this.lastCaptureAt };
    this.anchor = current;
    this.lastCaptureAt = nowMs;
    return { capture: true, holdProgress: 1, changeScore, status: "captured" };
  }
};

// src/pose/presets.ts
var SENSITIVITIES = ["low", "medium", "high"];
var CHANGE_THRESHOLDS = {
  low: 0.4,
  medium: 0.25,
  high: 0.15
};
function configForSensitivity(sensitivity, overrides = {}) {
  return mergeConfig(
    { ...DEFAULT_CONFIG, changeThreshold: CHANGE_THRESHOLDS[sensitivity] },
    overrides
  );
}
export {
  BODY_JOINTS,
  CHANGE_THRESHOLDS,
  DEFAULT_CONFIG,
  DEFAULT_MIN_SCORE,
  KEYPOINT_COUNT,
  KP,
  MIN_SHARED_JOINTS,
  MIN_TORSO_LENGTH,
  PoseChangeDetector,
  SENSITIVITIES,
  configForSensitivity,
  mergeConfig,
  normalizePose,
  parseMoveNetOutput,
  poseDistance
};
