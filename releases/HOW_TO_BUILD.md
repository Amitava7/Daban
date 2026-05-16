# Building the APK

The native Android project has been pre-generated (`android/` folder). Choose one of the options below to produce an APK.

---

## Option A — EAS Build (no local SDK required) ✅ Recommended

Builds on Expo's cloud infrastructure. Takes ~10–15 minutes.

```bash
# 1. Install EAS CLI
npm install -g eas-cli

# 2. Log in with your Expo account (free)
eas login

# 3. Build a preview APK
eas build -p android --profile preview
```

When done, download the `.apk` from the link shown in the terminal (or the Expo dashboard). Copy it here into `releases/`.

---

## Option B — Local build (requires Android SDK)

### Prerequisites
- **Java 17+** — `java -version`
- **Android SDK** — install via [Android Studio](https://developer.android.com/studio) or [command-line tools](https://developer.android.com/studio#command-tools)
- Set `ANDROID_HOME` to your SDK path

### Build steps

```bash
# From the repo root
cd android
./gradlew assembleRelease          # release build
# or
./gradlew assembleDebug            # debug build (easier, no signing needed)
```

Output APK:
```
android/app/build/outputs/apk/release/app-release-unsigned.apk
android/app/build/outputs/apk/debug/app-debug.apk
```

Copy the APK here into `releases/`.

### Signing a release build

Generate a keystore (one-time):
```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore chess-coach.keystore \
  -alias chess-coach \
  -keyalg RSA -keysize 2048 \
  -validity 10000
```

Add to `android/app/build.gradle` under `android { signingConfigs { ... } }`, then run `assembleRelease`.

---

## Option C — Expo Go (fastest, no build needed)

Install [Expo Go](https://expo.dev/go) on your Android device, then:

```bash
npm install
npm start          # shows a QR code
```

Scan the QR code with Expo Go. The app loads instantly over your local network — no APK needed for development testing.

---

## EAS Build Profiles (`eas.json`)

```json
{
  "build": {
    "preview": {
      "android": { "buildType": "apk" }
    },
    "production": {
      "android": { "buildType": "aab" }
    }
  }
}
```

Add this as `eas.json` in the repo root before running `eas build`.
