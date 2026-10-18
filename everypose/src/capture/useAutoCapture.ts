import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Haptics from 'expo-haptics'
import { usePhotoOutput, type CameraFrameOutput, type CameraPhotoOutput } from 'react-native-vision-camera'
import { detectorConfigFor } from '../billing/effectiveConfig'
import type { Plan } from '../billing/plans'
import { usePoseStream } from '../camera/usePoseStream'
import { poseFromOutput } from '../camera/tensor'
import { PoseChangeDetector, type DetectorStatus } from '../pose/detector'
import type { Sensitivity } from '../pose/presets'
import { usageStore, useUsage } from '../store/usage'
import { ensureGalleryPermission, saveToGallery } from './savePhoto'

export interface AutoCapture {
  /** Camera outputs to pass to the camera view. */
  outputs: (CameraPhotoOutput | CameraFrameOutput)[]
  ready: boolean
  /** Something the user should be told; null when all is well. */
  error: string | null
  status: DetectorStatus
  holdProgress: number
  changeScore: number | null
  lastPhotoUri: string | null
  /** Photos taken today. */
  used: number
  /** Photos left today; Infinity on Pro. */
  remaining: number
  limitReached: boolean
}

interface Options {
  plan: Plan
  sensitivity: Sensitivity
  /** False while the app is in the background or the user has paused. */
  enabled: boolean
}

/**
 * Watches the camera for pose changes and takes a photo, within the plan's daily limit, each
 * time the person holds a new pose. Photos go to the "everypose" gallery album.
 */
export function useAutoCapture({ plan, sensitivity, enabled }: Options): AutoCapture {
  const detector = useMemo(() => new PoseChangeDetector(), [])
  useEffect(() => {
    detector.setConfig(detectorConfigFor(plan, { sensitivity }))
  }, [detector, plan, sensitivity])

  const photoOutput = usePhotoOutput()

  const [live, setLive] = useState<{ status: DetectorStatus; holdProgress: number; changeScore: number | null }>({
    status: 'no-pose',
    holdProgress: 0,
    changeScore: null,
  })
  const [lastPhotoUri, setLastPhotoUri] = useState<string | null>(null)
  const [captureError, setCaptureError] = useState<string | null>(null)

  const usageLoaded = useUsage((s) => s.loaded)
  useUsage((s) => s.usage) // re-render when the count changes
  const gate = usageStore.getState().gate(plan)

  useEffect(() => {
    void usageStore.getState().load()
    void ensureGalleryPermission() // ask up front so the first photo is not delayed by a prompt
  }, [])

  // Stop running the pose model while paused, in the background, or out of free captures.
  const active = enabled && usageLoaded && gate.allowed

  const busy = useRef(false)
  const activeRef = useRef(active)
  activeRef.current = active
  const planRef = useRef(plan)
  planRef.current = plan

  const takePhoto = useCallback(async () => {
    busy.current = true
    let taken = false
    try {
      // Checked at the moment of capture, not when the pose was first seen.
      if (!usageStore.getState().gate(planRef.current).allowed) {
        taken = true // out of captures: nothing to retry
        return
      }
      if (!(await ensureGalleryPermission())) {
        setCaptureError('Allow photo access so everypose can save your photos.')
        return
      }
      const { filePath } = await photoOutput.capturePhotoToFile({ enableShutterSound: false }, {})
      // The photo exists from here on; count it even if showing it fails.
      const uri = await saveToGallery(filePath)
      taken = true
      usageStore.getState().record()
      if (uri != null) setLastPhotoUri(uri)
      setCaptureError(null)
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    } catch (e) {
      setCaptureError(`Could not take the photo: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      busy.current = false
      // Tell the detector the pose was not photographed, so it tries again after the cooldown.
      if (!taken) detector.undoCapture(performance.now())
    }
  }, [photoOutput, detector])

  const lastShown = useRef({ status: 'no-pose' as DetectorStatus, progress: 0 })
  const onKeypoints = useCallback(
    (raw: number[]) => {
      if (!activeRef.current) return
      const result = detector.update(poseFromOutput(raw), performance.now())

      // Re-render only when something the screen shows has visibly changed.
      const shown = lastShown.current
      if (result.status !== shown.status || Math.abs(result.holdProgress - shown.progress) >= 0.05) {
        lastShown.current = { status: result.status, progress: result.holdProgress }
        setLive({ status: result.status, holdProgress: result.holdProgress, changeScore: result.changeScore })
      }

      if (result.capture) {
        if (busy.current) detector.undoCapture(performance.now())
        else void takePhoto()
      }
    },
    [detector, takePhoto]
  )

  useEffect(() => {
    if (!enabled) detector.reset()
  }, [enabled, detector])

  const stream = usePoseStream(onKeypoints, active)
  const outputs = useMemo(() => [photoOutput, stream.frameOutput], [photoOutput, stream.frameOutput])

  return {
    outputs,
    ready: stream.ready && usageLoaded,
    error: stream.error ?? captureError,
    status: live.status,
    holdProgress: live.holdProgress,
    changeScore: live.changeScore,
    lastPhotoUri,
    used: gate.used,
    remaining: gate.remaining,
    limitReached: !gate.allowed,
  }
}
