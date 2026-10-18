# everypose

A camera app that takes a photo each time you hold a new pose. React Native (Expo) with an on-device
pose model. Free plan: 20 auto-captures a day. Pro: unlimited.

## Run it on an Android phone

You need Node 20+, and either **A** (Android Studio, a USB cable) or **B** (an Expo account, no Android Studio).
The app uses native code, so Expo Go cannot run it.

```bash
npm install
npm run model        # downloads the pose model once (about 5 MB) into assets/models/
```

Commit `assets/models/movenet_lightning.tflite` afterwards so a fresh clone works without this step.
If `npm run model` fails, it prints where to download the file by hand.

**A. Build on your computer**

1. Install [Android Studio](https://developer.android.com/studio) and JDK 17.
2. On the phone: Settings, About phone, tap *Build number* 7 times; then Developer options, turn on *USB debugging*.
3. Plug the phone in and allow the USB prompt. Check `adb devices` lists it.
4. `npm run android` (the first build takes several minutes).

**B. Build in the cloud (EAS)**

```bash
npx eas-cli@latest login
npx eas-cli@latest build --profile development --platform android
```

Install the APK it gives you, then `npm start` and open the app on the phone.

## What to check on the phone

1. Allow the camera and photo permissions.
2. Stand back so your head, shoulders, hips and legs are in view.
3. Hold a pose: the line under the preview should say "Hold still…", then a photo is taken (haptic buzz).
4. Move to a different pose and hold it: another photo. Standing still should not take more.
5. Photos appear in the gallery album **everypose**, and the small thumbnail shows the last one.
6. After 20 photos the counter reads "Daily limit reached". Start with `EXPO_PUBLIC_PLAN=pro npm start` to try Pro.

The grey text under the status line ("hold 40% · change 0.31") is for tuning. Note those numbers when something
feels wrong and send them over.

## Layout

- `src/pose/` pose maths and the pose-change detector (no native code, unit tested)
- `src/billing/` plans, the daily limit, usage storage
- `src/camera/`, `src/capture/` camera, pose model, saving photos
- `src/app/` screens (Expo Router)
- `design/ui-mockups.html` the screen designs; `harness/` a webcam test page for the detector

```bash
npm test             # unit tests
npm run typecheck
```
