# Detector test page

Runs the app's real `PoseChangeDetector` (bundled from `src/pose`) on a webcam, with the MoveNet Lightning
model from TensorFlow.js. It exists to check and tune Feature 1 before the React Native camera is built.

```bash
cd everypose
npm install
npm run harness            # builds harness/pose.bundle.js and serves http://localhost:8080
```

Open http://localhost:8080 on a computer with a webcam (camera access works on `localhost`; a phone needs HTTPS).
Press **Start camera**, stand back so your head, shoulders, hips and legs are in view, hold a pose, then change it.
`?demo=1` (or the "Try without a camera" button) feeds synthetic poses instead.

What to look for and tune (values live in `src/pose/presets.ts` and `src/pose/detector.ts`):

- A photo should not fire while you are mid-move, and should fire about `holdMs` after you settle.
- "Change from last photo" shows the distance to the last photo against the threshold (black mark).
  Note the value when a pose you consider new is ignored, or a repeat pose triggers a photo.
- Standing still should never take a second photo.

`pose.bundle.js` is generated; rebuild with `npm run harness:build` after changing `src/pose`.
