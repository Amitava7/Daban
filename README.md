# Chess Coach — React Native App

A fully offline mobile chess app that teaches you while you play. Every move is scored and explained, mistakes are diagnosed in plain language, and the engine actively shows you why blunders were wrong. All features work without an internet connection.

## Screens

| # | Screen | What it does |
|---|--------|-------------|
| 1 | **Home** | ELO stats, resume game hero, nav to all sections |
| 2 | **Game** | Live board, always-on coach quote, eval bar, hints |
| 3 | **Hint** | Top 3 engine moves with animated arrows & explanations |
| 4 | **Feedback** | Per-move verdict toast, blunder card with diagnosis |
| 5 | **Refutation** | Animated piece sequence showing the punishing line |
| 6 | **Review** | Eval graph scrubber, board synced to move, pattern callout |
| 7 | **Openings** | Daily weakness recommendation + full opening library |
| 8 | **Endgames** | Daily essential endgame + category progress |
| 9 | **Progress** | ELO trend, insight cards (patterns behind your mistakes) |
| 10 | **Settings** | Difficulty slider (Lv 1–10 ≈ ELO), coach personality, dark mode |
| 11 | **Lessons** | Topic grid + "next lesson" resume card |
| 12 | **Lesson Topic** | Lessons in a topic with star scores and unlock gating |
| 13 | **Lesson Player** | Guided challenges: coach bubble, hints, arrows, scoring |

## Color Configuration

**All colors are in one file: [`src/theme/colors.ts`](src/theme/colors.ts)**

To retheme the app, edit only that file. It exports `LightColors` and `DarkColors` objects with named tokens:

```ts
// Brand color — change this to retheme everything
brand: '#c25e3a',   // terracotta (default)

// Semantic
good: '#4d7c45',    // green — strong move / improvement
warn: '#b8801f',    // amber — inaccuracy
bad:  '#c4453a',    // red   — blunder / regression

// Chess board
boardLight: '#ede2c5',
boardDark:  '#b0905f',
```

Light and dark variants are toggled at runtime via the Settings screen's dark mode toggle — no restart needed.

## Project Structure

```
src/
  theme/
    colors.ts         ← THE config file — all colors here
  context/
    ThemeContext.tsx   ← provides colors + toggle to all components
  components/
    AppBar.tsx         ← top navigation bar
    Board.tsx          ← 8×8 chess board with Unicode pieces
    Card.tsx           ← card surface (default / brand / good / warn / bad)
    EvalBar.tsx        ← vertical eval bar (black/white ratio)
    EvalBar.tsx
    NavRow.tsx         ← tappable list row with icon + chevron
    Pill.tsx           ← inline status chip
    Sparkline.tsx      ← SVG line chart (ELO trend, eval graph)
    StatChip.tsx       ← stat block (ELO, streak, accuracy)
  lessons/             ← the guided-lessons knowledge base + runtime
    types.ts           ← lesson/step schema (authoritative)
    config.ts          ← topics + lesson metadata (menus render from this)
    index.ts           ← lessonId → JSON registry
    LessonEngine.ts    ← pure reducer driving every lesson
    progress.ts        ← unlock/star/next-lesson helpers
    data/<topic>/*.json ← one file per lesson
  screens/             ← one file per screen (see table above)
  navigation/
    AppNavigator.tsx   ← stack navigator wiring all screens
    types.ts           ← route param types
```

## Lessons

A chess.com-style guided lessons section: 51 lessons across 10 topics, from
piece basics to Fischer's Game of the Century. Lessons are **data, not code** —
adding one needs no changes to the app.

```bash
npm run validate:lessons   # replay every FEN/SAN through chess.js
npm run test:engine        # drive every lesson through the real reducer
node scripts/probe-lesson.js   # position workbench for lesson authors
```

- **[docs/lessons/README.md](docs/lessons/README.md)** — authoring workflow (start here)
- [docs/lessons/AUTHORING.md](docs/lessons/AUTHORING.md) — sourcing material and writing lessons
- [docs/lessons/VALIDATION.md](docs/lessons/VALIDATION.md) — verification toolchain and failure catalogue
- [docs/LESSONS_PLAN.md](docs/LESSONS_PLAN.md) — runtime architecture

## Running Locally

### Prerequisites

- Node.js 18+
- Expo Go app on your phone ([iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))

### Start

```bash
npm install
npm start
```

Scan the QR code with Expo Go to run on your device.

### Platform-specific

```bash
npm run android    # Android emulator (requires Android Studio)
npm run ios        # iOS simulator (requires macOS + Xcode)
npm run web        # Browser (limited native feature support)
```

## Building a Release APK

### Option A — EAS Build (recommended, no local SDK needed)

```bash
npm install -g eas-cli
eas login                      # log in with your Expo account
eas build -p android --profile preview
```

The APK will be available to download from the Expo dashboard once the cloud build finishes (~10–15 min).

### Option B — Local build

Requires Android SDK (API 35) and Java 17+.

```bash
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
# APK → android/app/build/outputs/apk/release/app-release.apk
```

Copy the output APK into the `releases/` folder.

## Dependencies

| Package | Purpose |
|---------|---------|
| `@react-navigation/native-stack` | Screen navigation |
| `react-native-svg` | Sparkline + eval graphs |
| `@react-native-community/slider` | Difficulty & eval scrubber |
| `react-native-safe-area-context` | Notch / home indicator insets |
| `react-native-reanimated` | Animation primitives |
| `react-native-gesture-handler` | Touch gesture system |

## Design Source

Implemented from a Hi-Fi HTML/CSS prototype. The design uses:
- **Newsreader** (serif) for display headings → `fontFamily: 'serif'` in RN
- **JetBrains Mono** for notation → `fontFamily: 'monospace'` in RN
- Warm parchment palette (`#f4efe4`) with terracotta accent (`#c25e3a`)

Full design files are in the `daban/project/` export bundle.
