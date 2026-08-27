# Validating lessons

The knowledge base is executable data: every position and move in it is
machine-checked. This is what makes lessons safe to author at volume.

---

## 1. The workbench: `scripts/probe-lesson.js`

`scripts/probe-lesson.js` answers every question that comes up while authoring.
Use it *before* writing anything into a JSON file.

```bash
P=scripts/probe-lesson.js

node $P game  "e4 e5 Nf3 Nc6 Bb5"          # replay from the start
node $P game  --at 48 "e4 e5 ..."          # FEN after 48 plies (= White's move 25)
node $P line  "<fen>" "Bf6 Qxh5 Rxg7+"     # replay a line from a FEN
node $P san   "<fen>" "Ne7+"               # legal? canonical SAN? replies forced?
node $P moves "<fen>" --captures           # legal moves — pick rejections from here
node $P mate  "<fen>" --plies 5            # exhaustive forced-mate search
```

**Invoke it directly, as above.** `npm run probe` works for flagless commands,
but npm swallows any argument starting with `--` (so `--at 48` silently
vanishes) unless you write `npm run probe -- game --at 48 …`. Quoting is
optional for FENs — the tool reassembles one that a shell split across
arguments.

What each answers:

- **`game`** — is this score real, and what's the FEN at the decision point?
  Move numbers are optional; `1.e4 e5 2.Nf3` and `e4 e5 Nf3` both parse.
- **`line`** — does my combination actually work? Prints each ply's canonical
  SAN, flags input that differs, suggests the right `assert`, and checks the
  odd-length rule.
- **`san`** — the workhorse. Confirms legality, prints the **canonical** SAN
  (so you write `Bxc6+`, not `Bxc6`), and lists the opponent's replies with a
  `FORCED` marker when there's exactly one.
- **`moves`** — the menu to choose plausible rejections from.
- **`mate`** — the one that saves lessons. Only returns a line if **every**
  defence is covered. A "no forced mate" result on a position you believed in
  means the position is wrong.

---

## 2. Gate one: `npm run validate:lessons`

Static + replay validation of every file. Must be **0 errors** before commit.

It checks:

- JSON parses; `id` == filename; directory == `topic`; level in 1–6; required
  metadata present.
- Every FEN loads; **every SAN in every line, rejection, and `autoMoves` list
  is legal** in its position.
- Solution lines have odd length (end on a user move).
- `assert` claims are true — `checkmate` really mates, `capture` really
  captures, `stalemate` really stalemates.
- Rejections are legal, carry a `say`, aren't a solution's first move, and
  don't satisfy the `goal`.
- `goal` is achievable in one move; `sequenceGoal` is completable (proved by
  depth-first search over consecutive captures).
- Every lesson is present in `config.ts` and `index.ts`, and **every registry
  entry has its data file** (error — it breaks the release bundle).

Two warnings are expected and intentional (`basics/the-pawn`,
`basics/special-moves` keep `highlights` on a late challenge deliberately —
they're level-1 lessons for absolute beginners). Everything else should be
silent.

## 3. Gate two: `npm run test:engine`

Drives all lessons through the **real** `LessonEngine` reducer — the same code
the app runs — by transpiling it in memory. Must be **0 failures**.

Per lesson it verifies:

- A clean run reaches `lesson-complete`, scores 100%, and earns 3 stars.
- **Every alternative solution branch** is playable end to end.
- **Every rejection** produces `feedback-bad`, keeps its tailored text, counts
  the mistake, and rewinds to the exact starting position on retry — and the
  solution still works afterwards.
- Hints escalate in order and the final hint puts a valid arrow on the board.
- Two mistakes auto-arm the arrow without the user asking.
- A hint-assisted run scores below 100% (hints must cost something).

This is where a lesson that *validates* but doesn't *play* gets caught.

## 4. Gate three: see it in the app (optional but advised)

For UI-affecting changes, or once per large batch:

```bash
EXPO_OFFLINE=1 EXPO_NO_DEPENDENCY_VALIDATION=1 npx expo start --web --offline --port 8082
rm -f tsconfig.json     # Expo auto-generates one; it is not wanted in the repo
```

Then drive it with Playwright against `http://localhost:8082` (Chromium is
preinstalled at `/opt/pw-browsers/chromium`; launch with `--no-proxy-server`).
Notes that cost time to rediscover:

- React Navigation keeps previous screens mounted but hidden — always select
  with `.locator('visible=true').first()`, or clicks hit an invisible copy.
- Metro started with `CI=1` **does not hot-reload**; restart it after edits or
  you'll test stale code.
- Kill the server by port (`fuser -k 8082/tcp`). Do **not** `pkill -f "expo
  start"` — the pattern matches the shell running it and kills your own
  command (exit code 144).
- Web preview needs `react-dom`, `react-native-web` and `@expo/metro-runtime`.
  Install them with `--no-save --legacy-peer-deps`, and pin
  `react-native-reanimated` to the lockfile's version in the same command —
  installing it separately prunes the others, and a drifted Reanimated crashes
  the app on boot with a Worklets version mismatch.

## 5. Gate four: CI and the APK

Every push to `claude/**` or the default branch runs
`.github/workflows/build-apk.yml`: `npm ci` → `expo prebuild` → Gradle release
build → a GitHub Release tagged `build-<run number>` with `app-release.apk`
attached. It takes ~25 minutes, so let the local gates catch everything first.

If CI fails, the failing step tells you which class of problem you have:

| Failing step | Cause |
|---|---|
| `Install dependencies` | `package.json` and `package-lock.json` disagree. `npm ci` refuses to guess. Fix with `npm install --package-lock-only --legacy-peer-deps` and commit the lockfile |
| `Build release APK` → `createBundleReleaseJsAndAssets` | Metro couldn't resolve a `require()` — almost always a registry entry with no data file |
| `Build release APK` → Gradle/Java errors | Native build; unrelated to lesson content |

---

## 6. chess.js behaviours worth knowing

Pinned at `chess.js@1.3.0`. These bit us:

- **Sloppy SAN in, canonical SAN out.** `chess.move("Bxc6")` succeeds for a
  move that is really `Bxc6+`. The validator therefore accepts non-canonical
  SAN in your data, but the *engine* compares canonical forms at runtime.
  (The engine canonicalizes both sides before comparing, so this no longer
  breaks matching — but write canonical SAN anyway: `probe-lesson.js san` prints
  it for you.)
- **Both kings are mandatory.** A FEN without a black king throws
  `Invalid FEN: missing black king`.
- **A position where the side *not* to move is in check loads fine.** That
  looseness is what makes `sequenceGoal` capture chains possible (the engine
  hands the turn straight back to the mover).
- **A promotion move needs its `promotion` field** — `{from:'e7',to:'e8'}`
  throws — but a `promotion` field on a *non*-promotion move is ignored, not
  rejected.
- `moves()` returns SAN strings; `moves({verbose:true})` returns objects with
  `from`, `to`, `captured`, `promotion`, `piece`.

---

## 7. Failure catalogue

Real failures from the first 51 lessons, with the lesson learned.

**Content**

| Symptom | Cause | Prevention |
|---|---|---|
| `illegal SAN "Nxe4" at position …` | Rejection move invented from memory | Probe **every** rejection with `probe san` |
| `assert "checkmate" failed` | The line ends in check, not mate | Let `probe line` suggest the assert |
| `goal "checkmate" is unachievable` | `goal` attached to a multi-move mate | `goal` = one move only; use `solutions` for sequences |
| Lesson teaches the "wrong" best move | The constructed position had a faster mate (a queen on d3 gave mate in 1 in a position built for a 9-move combination) | `probe mate` every constructed position before writing |
| Combination collapses one move in | Move order mattered and the draft had it backwards (Boden's `d5` clears the author's *own* bishop diagonal — without it, `Ba3` is illegal) | Replay the whole line; ask *why* each preparatory move exists |
| Rejection text contradicts itself | Prose written before the line was checked | Write coaching text *after* probing, not before |
| "wait, no…" shipped in a hint | Reasoning left in the output | `grep -rn "wait, no\|no wait\|hmm" src/lessons/data` before commit |

**Integration**

| Symptom | Cause | Prevention |
|---|---|---|
| CI green locally, `createBundleReleaseJsAndAssets` fails | Registered a lesson in `index.ts` before writing its JSON | Write file → then register (now an error in the validator) |
| Ten registry entries never checked | Validator regex used `[a-z]+` for the topic segment; hyphenated topics didn't match | Allow hyphens in any id/topic regex you write |
| `npm ci` fails with `EUSAGE … not in sync` | Added a dependency to `package.json` without updating the lockfile | `npm install --package-lock-only --legacy-peer-deps`, verify with `npm ci --dry-run` |

**Environment**

| Symptom | Cause |
|---|---|
| Command exits 144 for no reason | `pkill -f "expo start"` matched the shell running it — kill by port instead |
| `expo start` dies with `Host not in allowlist` | Needs `EXPO_OFFLINE=1 EXPO_NO_DEPENDENCY_VALIDATION=1` behind the egress proxy |
| App boots to a blank screen | Reanimated/Worklets version mismatch from a lockfile-free install |
| `tsconfig.json` appears in `git status` | Expo generates one on `expo start`; delete it |
| `database.lichess.org` returns 403 | Blocked by network policy — plan sourcing around it |

---

## 8. Extending the validator

When you add a schema feature, add its check here too — the validator is the
contract. Follow the existing shape: `err()` for anything that would break the
app or teach something false, `warn()` for style conventions. Anything that can
fail the release build must be an `err()`, because 25 minutes of CI is a
terrible way to learn about a typo.
