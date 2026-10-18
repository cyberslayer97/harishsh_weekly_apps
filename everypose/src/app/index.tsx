import { useEffect, useState } from 'react'
import { ActivityIndicator, AppState, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera'
import { useKeepAwake } from 'expo-keep-awake'
import { useCurrentPlan } from '../billing/currentPlan'
import { useAutoCapture } from '../capture/useAutoCapture'
import type { DetectorStatus } from '../pose/detector'
import { theme } from '../theme'

const STATUS_TEXT: Record<DetectorStatus, string> = {
  'no-pose': 'Step back so your head, shoulders and hips are in view',
  unsure: 'Not enough of you is visible to compare',
  'same-pose': 'Strike a new pose',
  moving: 'New pose · hold still',
  holding: 'Hold still…',
  cooldown: 'Photo taken · next one in a moment',
  captured: 'Photo taken',
}

function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active')
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'))
    return () => sub.remove()
  }, [])
  return active
}

export default function CameraScreen() {
  const insets = useSafeAreaInsets()
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission()
  const [facing, setFacing] = useState<'front' | 'back'>('front')
  const device = useCameraDevice(facing)
  const appActive = useAppActive()
  const [paused, setPaused] = useState(false)
  const plan = useCurrentPlan()
  const capture = useAutoCapture({ plan, sensitivity: 'medium', enabled: appActive && !paused })
  useKeepAwake()

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Camera access</Text>
        <Text style={styles.body}>
          everypose needs the camera to see your pose and take a photo when it changes. Nothing leaves your phone.
        </Text>
        {canRequestPermission ? (
          <Pressable style={styles.primary} onPress={() => void requestPermission()} accessibilityRole="button">
            <Text style={styles.primaryText}>Allow camera</Text>
          </Pressable>
        ) : (
          <Text style={styles.body}>Camera access is off. Turn it on for everypose in your phone's Settings.</Text>
        )}
      </View>
    )
  }

  if (device == null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} />
        <Text style={styles.body}>Looking for a camera…</Text>
      </View>
    )
  }

  const message = capture.error ?? (!capture.ready ? 'Getting ready…' : capture.limitReached ? 'Daily limit reached' : STATUS_TEXT[capture.status])
  const counter = capture.remaining === Infinity ? `${capture.used} today` : `${capture.used} / ${capture.used + capture.remaining} today`

  return (
    <View style={styles.fill}>
      <Camera style={StyleSheet.absoluteFill} device={device} outputs={capture.outputs} isActive={appActive && !paused} />

      <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
        <View style={styles.pill}>
          <View style={[styles.dot, { backgroundColor: paused ? theme.warn : theme.ok }]} />
          <Text style={styles.pillText}>{paused ? 'Paused' : 'Auto-capture on'}</Text>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{counter}</Text>
        </View>
      </View>

      <View style={[styles.messageWrap, { bottom: insets.bottom + 168 }]} pointerEvents="none">
        <View style={[styles.pill, capture.error ? styles.pillWarn : null]}>
          <Text style={[styles.pillText, capture.error ? styles.warnText : null]}>{message}</Text>
        </View>
        {capture.ready && !capture.error ? (
          <Text style={styles.debug}>
            hold {(capture.holdProgress * 100).toFixed(0)}% · change {capture.changeScore == null ? '–' : capture.changeScore.toFixed(2)}
          </Text>
        ) : null}
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.side}>
          {capture.lastPhotoUri ? (
            <Image source={{ uri: capture.lastPhotoUri }} style={styles.thumb} accessibilityLabel="Last photo" />
          ) : (
            <View style={[styles.thumb, styles.thumbEmpty]} />
          )}
          <Text style={styles.label}>Last</Text>
        </View>
        <View style={styles.side}>
          <Pressable
            style={styles.shutter}
            onPress={() => setPaused((p) => !p)}
            accessibilityRole="button"
            accessibilityLabel={paused ? 'Resume auto-capture' : 'Pause auto-capture'}
          >
            <View style={styles.shutterInner}>
              <Text style={styles.shutterText}>{paused ? '▶' : '❚❚'}</Text>
            </View>
          </Pressable>
          <Text style={styles.label}>{paused ? 'Resume' : 'Pause'}</Text>
        </View>
        <View style={styles.side}>
          <Pressable
            style={styles.flip}
            onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}
            accessibilityRole="button"
            accessibilityLabel="Flip camera"
          >
            <Text style={styles.flipText}>⟲</Text>
          </Pressable>
          <Text style={styles.label}>Flip</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, backgroundColor: theme.bg },
  title: { fontSize: 24, fontWeight: '700', color: theme.textHeading },
  body: { fontSize: 16, lineHeight: 24, color: theme.textBody, textAlign: 'center' },
  primary: { backgroundColor: theme.accent, borderRadius: 10, minHeight: 48, paddingHorizontal: 24, justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  top: { position: 'absolute', top: 0, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  pillWarn: { backgroundColor: theme.warnBg },
  pillText: { fontSize: 14, fontWeight: '600', color: theme.textHeading },
  warnText: { color: theme.warn },
  dot: { width: 8, height: 8, borderRadius: 4 },
  messageWrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', gap: 8 },
  debug: { fontSize: 12, color: '#fff', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
  controls: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', paddingTop: 16, backgroundColor: 'rgba(255,255,255,0.94)' },
  side: { alignItems: 'center', gap: 4, minWidth: 72 },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', color: theme.textMuted },
  thumb: { width: 48, height: 48, borderRadius: 10, borderWidth: 2, borderColor: '#fff', backgroundColor: theme.accentSoft },
  thumbEmpty: { borderColor: theme.accentSoft },
  shutter: { width: 68, height: 68, borderRadius: 34, borderWidth: 4, borderColor: theme.accent, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
  shutterText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  flip: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' },
  flipText: { fontSize: 22, color: theme.textHeading },
})
