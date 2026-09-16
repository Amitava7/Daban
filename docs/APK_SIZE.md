# APK size

Daban's APK was dominated by two things that have nothing to do with the app's
own code: Stockfish's neural networks, and three CPU architectures the target
device cannot run. This document records what was measured, what changed, and
which knobs to turn if you want the size or the strength back.

---

## 1. Where the bytes were going

### Stockfish's NNUE networks — ~69 MB

`modules/expo-stockfish` builds Stockfish 16.1 from source. Stockfish 16.1 is a
dual-net engine: it embeds **both** networks into the binary at compile time
(via `incbin`), and picks between them at runtime — the small one for positions
with a large material imbalance, the big one everywhere else.

| file | size |
| --- | --- |
| `nn-b1a57edbea57.nnue` (big) | 65,429,575 B (62.4 MiB) |
| `nn-baff1ede1f90.nnue` (small) | 3,480,122 B (3.3 MiB) |

Measured by compiling the engine both ways (host x86-64, `-O2`):

| build | binary |
| --- | --- |
| stock, both nets | 69.4 MB |
| small net only | 3.9 MB |

Native libraries are stored **uncompressed** in the APK (`useLegacyPackaging`
defaults to `false` on SDK 54), so that 69 MB landed in the APK essentially
1:1. Compressing it would not have helped much either — the big net only gzips
from 65.4 MB to 55.3 MB.

### Three unused ABIs — ~30 MB and up

The Stockfish module already restricted itself to `arm64-v8a`, but the app did
not, so every prebuilt React Native library was packaged four times over.
Measured from the Maven artifacts React Native 0.81.5 actually ships:

| artifact | arm64-v8a | the other three ABIs |
| --- | --- | --- |
| `react-android` | 7.9 MB | 21.9 MB |
| `hermes-android` | 2.1 MB | 6.3 MB |

That is ~28 MB of dead weight before counting Reanimated, Worklets, Screens,
SVG and the Expo modules, which are compiled per ABI as well (they also made
every clean build roughly four times slower than it needed to be).

---

## 2. What changed

### Small-net-only engine (default)

`modules/expo-stockfish/android/CMakeLists.txt` now patches the fetched
Stockfish source before building it:

1. `evaluate.h` — the big net's default filename is pointed at the small net.
2. `nnue/nnue_architecture.h` — `TransformedFeatureDimensionsBig` is set to the
   small net's value (2560 → 128), so the "big" network has the small
   network's architecture and the shared file's architecture hash matches.
3. `evaluate.cpp` — the big net's `INCBIN` is dropped and the big network reads
   its parameters from the small net's embedded copy, so the file is embedded
   once rather than twice.

The patch is applied to a freshly restored checkout on every CMake configure,
so switching modes or bumping `SF_TAG` can never leave a half-patched tree.
Each edit is checked before it is applied: if a future Stockfish release moves
this code, the build **fails loudly** instead of quietly shipping a 70 MB
engine again.

The engine is otherwise stock Stockfish 16.1 — same search, same UCI, same
`UCI_LimitStrength` / `UCI_Elo` handling the coach levels rely on.

### arm64-v8a only, plus R8

`app.json` now configures `expo-build-properties`:

- `buildArchs: ["arm64-v8a"]` — the only ABI the S24 Ultra runs. This becomes
  `reactNativeArchitectures` in `gradle.properties`, which the React Native
  Gradle plugin turns into `defaultConfig.ndk.abiFilters`.
- `enableMinifyInReleaseBuilds` + `enableShrinkResourcesInReleaseBuilds` — R8
  shrinking for the dex and resources in release builds.
- `extraProguardRules` keeps `expo.modules.stockfish.**`, which JNI resolves by
  fully-qualified name.

The Stockfish build also picked up `-ffunction-sections -fdata-sections` and
`-Wl,--gc-sections`, and the arm-specific `-march=armv8.2-a+dotprod` tuning is
now guarded so the same `CMakeLists.txt` still configures on a host machine for
testing.

### Expected result

The two measured savings are ~65 MB of network and ~28 MB of unused-ABI React
Native libraries, plus whatever R8 removes from the dex and the per-ABI copies
of Reanimated/Worklets/Screens/SVG. That should put the APK in the low tens of
megabytes rather than the low hundreds. Build it and check
`releases/` — the exact figure has not been measured on a real build yet.

---

## 3. What it costs, measured

The small net is a smaller brain, so it is weaker. Both engines were run
head-to-head on the same positions (single thread, identical settings):

| | same best move | median \|Δeval\| | worst \|Δeval\| |
| --- | --- | --- | --- |
| `go depth 16` | 10/12 | 26 cp | 77 cp |
| `go movetime 300` (what `MoveClassifier` uses) | 9/12 | 35 cp | 62 cp |

Tactics and mates were identical (`mate 1`/`mate 2` found by both in every test
position), and basic endgames tracked closely — K+P vs K was correctly ~0.0 for
both, Philidor 0 vs −51 cp, R+P vs R 535 vs 524 cp. The disagreements were
quiet opening/middlegame positions where several moves are near-equal.

For this app that is an acceptable trade:

- Coach play is capped through `UCI_Elo` (see `StockfishUci.setElo`), and the
  small net is still far stronger than the ceiling.
- `MoveClassifier` compares eval *before* and *after* a move using the same
  net, so a systematic offset largely cancels; its bands are coarse
  (best ≤ 10 cp, excellent ≤ 25, good ≤ 75, inaccuracy ≤ 200).

If the coaching feedback ever looks off, put the big net back — it is one flag.

---

## 4. Knobs

**Full-strength engine** (adds ~65 MB):

```bash
cd android && ./gradlew assembleRelease -Pdaban.stockfishNet=big
```

or add `daban.stockfishNet=big` to `android/gradle.properties` (EAS builds use
that file, since they never see your `-P` flags).

**Other ABIs** — `buildArchs` in `app.json` is why release builds only run on
arm64 devices. An x86_64 emulator needs `"buildArchs": ["arm64-v8a", "x86_64"]`
and a fresh `npx expo prebuild --clean`.

**Two more levers, both left off deliberately:**

- `"enableBundleCompression": true` compresses the JS bundle in the APK. Saves
  a couple of MB, costs startup time.
- `"useLegacyPackaging": true` compresses the `.so` files. Saves download size,
  but the libraries are then extracted at install time, so the device uses more
  space overall and startup is slower.

**If R8 ever breaks something** (a missing Expo module, a reflection crash),
set `enableMinifyInReleaseBuilds` to `false` in `app.json` and add a keep rule
for whatever was stripped rather than leaving it off for good.
