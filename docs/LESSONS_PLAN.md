# Lessons — Implementation Plan

A chess.com-style guided lessons section for Daban: pick a topic, work through
ordered lessons, and inside each lesson play a series of interactive
"challenges" on the board while a coach asks questions, gives feedback, and
offers progressive hints. This document is the blueprint; the knowledge base
under `src/lessons/` is the content it describes.

---

## 1. What the chess.com flow actually is (from the reference video)

Observed mechanics we replicate:

1. **Lessons menu** — topic tiles (Openings, Strategy, Tactics, Endgames,
   Master Games, Attacking) plus a "Next Lesson" resume card and level
   filters.
2. **Lesson intro** — board shows the starting position of the lesson, coach
   bubble states the goal ("Take control of the game by developing your
   pieces rapidly…"), a single **Start** button.
3. **Challenge loop** (`Challenge 1/5`, `2/5`, …):
   - Board is set to a specific position; a "White to Move / Black to Move"
     chip plus a **question** ("How can Black develop a knight to defend the
     pawn?") appear in the coach bubble.
   - The user moves a piece on the real board.
   - **Correct** → green ✓ "Nf3 is correct" + a *why* sentence ("This is by
     far the most popular move by top players in that position."), sometimes
     an automatic opponent reply is animated, then next challenge.
   - **Incorrect** → red ✗ "d4 is incorrect" + a *specific refutation* when
     the mistake was anticipated ("Black wins a pawn. Try to find a safer
     pawn move…"), board resets, user retries. Retries are unlimited but
     cost score.
   - **Hints** — a lightbulb button; first press = text hint, second press =
     highlight/arrow on the board. Yellow highlighted squares also appear in
     harder prompts as built-in guidance.
   - A **progress bar** fills per completed challenge.
4. **Completion** — score summary (percentage of challenges solved on the
   first try), next-lesson suggestion, progress recorded on the lesson path.
5. **Difficulty ramps two ways**: within a lesson (later challenges get
   vaguer questions and no pre-highlighted squares) and across lessons
   (topics are ordered into levels — piece basics → openings → tactics →
   strategy → advanced endgames).

---

## 2. Architecture overview

```
src/lessons/
  types.ts              # TypeScript schema for the whole knowledge base
  config.ts             # topics, levels, lesson metadata, ordering, unlocks
  index.ts              # registry: lessonId -> statically require()'d JSON
  data/
    basics/*.json       # one file per lesson: { meta…, steps: [ … ] }
    fundamentals/*.json
    openings/*.json
    tactics/*.json
    strategy/*.json
    endgames/*.json
scripts/
  validate-lessons.js   # replays every FEN/SAN through chess.js, enforces asserts
```

Design choice (vs. one giant config + huge arrays): **one JSON file per
lesson** keeps files reviewable, diffs small, authoring resumable, and lets
Metro bundle them statically via a `require` map in `index.ts` (no dynamic
imports needed in React Native). `config.ts` holds only lightweight metadata
so the topic/lesson menus render without loading step data.

### Why JSON + a validator instead of hand-trusted data

Every challenge is executable: FENs must parse, SANs must be legal, "mate in
1" must actually mate. `scripts/validate-lessons.js` (run with
`node scripts/validate-lessons.js`, wired into CI later) loads every lesson,
replays every line with chess.js and fails loudly on:

- invalid FEN or side-to-move mismatch with the prompt;
- illegal SAN anywhere (solutions, replies, rejections, autoMoves);
- broken `assert` claims (`checkmate`, `check`, `capture`, `stalemate`,
  `promotion`, `draw`);
- duplicate lesson ids, ids missing from `config.ts`, schema violations
  (missing prompts/hints/feedback).

This turns the knowledge base into tested data, not prose.

---

## 3. Knowledge-base schema (`src/lessons/types.ts`)

A lesson is a metadata header plus an ordered array of **steps**. Three step
kinds cover everything seen in the video:

```ts
type LessonStep = IntroStep | ExplainStep | ChallengeStep;
```

### 3.1 `IntroStep` — coach talks, user reads

```jsonc
{ "kind": "intro",
  "fen": "start-or-any-FEN",
  "say": "Take control of the game by developing your pieces rapidly...",
  "highlights": ["e4", "d4"],            // optional colored squares
  "arrows": [{ "from": "g1", "to": "f3" }] // optional arrows
}
```

Rendered with a **Start/Next** button. Also used mid-lesson to introduce a
new concept before harder challenges.

### 3.2 `ExplainStep` — animated demonstration

```jsonc
{ "kind": "explain",
  "fen": "...",
  "say": "Watch how the rook ladder pushes the king to the edge.",
  "autoMoves": [
    { "san": "Ra7", "say": "The first rook cuts off the 7th rank." },
    { "san": "Kd8" },
    { "san": "Rb8#", "say": "The second rook delivers mate on the edge." }
  ]
}
```

The engine animates `autoMoves` with ~700 ms delays (same rhythm as
`OpeningDrillScreen`'s engine replies), updating the coach bubble per
annotated move. A **Replay** affordance is cheap to add since moves replay
from the step's FEN.

### 3.3 `ChallengeStep` — the minigame

```jsonc
{ "kind": "challenge",
  "fen": "...",
  "prompt": "Develop your bishop to attack a black knight.",
  "hints": [
    "Your light-squared bishop can reach an aggressive diagonal.",
    "Look at the b5 square — what does the bishop hit from there?"
  ],
  "hintArrows": [{ "from": "f1", "to": "b5" }], // shown on final hint / after 2 fails
  "highlights": ["b5"],                          // optional built-in guidance (easy steps)
  "solutions": [
    { "line": [
        { "san": "Bb5", "say": "Perfect — the bishop pins ideas onto c6." },
        { "san": "a6",  "say": "Black challenges your bishop immediately." },
        { "san": "Ba4", "say": "Keep the tension — the pin potential remains." }
      ],
      "assert": null
    },
    { "line": [ { "san": "Bc4", "say": "Also strong — eyeing the weak f7 pawn." } ] }
  ],
  "rejections": [
    { "san": "d4", "say": "Black wins a pawn after exd4. Try a safer developing move." }
  ],
  "wrongSay": "Not quite — remember the goal: develop with a threat.",
  "successSay": "Challenge complete! Bishops love open diagonals."
}
```

Semantics, implemented by the lesson engine:

- **Lines alternate plies.** Index 0, 2, 4… are user moves that must be
  matched; index 1, 3, 5… are opponent replies the app plays automatically.
  A one-entry line is a single-move challenge. Multi-move lines are how a
  challenge teaches short sequences (e.g. ladder mate, promotion race).
- **Multiple `solutions`** = alternative accepted first moves, each with its
  own continuation and feedback. The first solution is the "main" line used
  for hint arrows.
- **`rejections`** are *anticipated* wrong moves with tailored coaching —
  the chess.com signature ("d4 is incorrect — Black wins a pawn…"). Any
  other wrong move gets `wrongSay` (or a generic default). After a wrong
  move the board flashes the bad square red and **resets to the step's
  position for the current ply** (mid-line mistakes rewind only the current
  user ply, not the whole challenge).
- **`assert`** (optional, per line): `"checkmate" | "check" | "capture" |
  "promotion" | "stalemate" | "draw"` — a machine-checked claim about the
  line's final user move. The validator enforces it; the UI can also use it
  ("Checkmate! 🎉").
- **Free-play challenges**: for goals with many valid answers (e.g. "capture
  the undefended pawn", "promote the pawn"), instead of enumerating every
  SAN, a challenge may specify a **goal**:

```jsonc
  "goal": { "type": "capture-on", "squares": ["d5"] }
  // or { "type": "checkmate" } | { "type": "promote" }
  //    | { "type": "reach", "squares": ["e4"], "piece": "N" }
  //    | { "type": "check" }
```

  When `goal` is present, any legal user move satisfying it is correct
  (solutions may still exist to provide preferred-move feedback). This keeps
  piece-movement minigames ("capture all the pawns with the rook") compact.
- **`sequenceGoal`** (optional): for multi-capture minigames — e.g.
  `{ "type": "capture-all", "count": 3 }` keeps the same challenge active,
  with the user moving repeatedly (opponent passes or has no pieces that
  can move — validator checks the position makes this sound) until all
  targets are gone. Used in the piece-basics lessons.

### 3.4 Lesson header

```jsonc
{ "id": "develop-your-pieces",
  "title": "Develop Your Pieces",
  "topic": "openings",
  "level": 3,                       // 1..6, chess.com-style
  "subtitle": "Get your minor pieces off the back rank fast.",
  "goals": ["Develop with threats", "Knights before bishops", "Don't move twice"],
  "estMinutes": 5,
  "steps": [ … ]
}
```

`config.ts` mirrors id/title/topic/level/subtitle/estMinutes + `order` so
menus never parse step arrays.

---

## 4. Progressive difficulty model

Three deliberate mechanisms, all encoded in data (no special engine logic):

1. **Level bands across topics** (`config.ts`): Basics (L1) → Fundamentals
   (L2) → Openings (L3) → Tactics (L3–4) → Strategy (L4–5) → Endgames
   (L4–6). The lessons menu sorts and badges by level; the "Next Lesson"
   card picks the first incomplete lesson in order.
2. **Unlock rule**: within a topic, lesson *n+1* unlocks when lesson *n* is
   completed (any score). Topics themselves are always browsable —
   chess.com lets you jump around; we gate only within a topic. (Stored in
   progress, see §6.)
3. **Within-lesson ramp**, encoded by authoring convention:
   - early challenges: concrete prompts ("Move your rook to capture the
     pawn"), `highlights` pre-lit, 1-move lines;
   - middle: conceptual prompts ("Develop a piece toward the center"),
     hints only on demand;
   - final "boss" challenge: vague prompt ("Find the best move"),
     multi-move line, no highlights, first hint is Socratic ("What is
     Black's only defender of e5?").

   The validator enforces a soft rule: every challenge has ≥1 hint, and no
   `highlights` on steps past the lesson midpoint (warning, not error).

---

## 5. Lesson engine (runtime) — `src/lessons/LessonEngine.ts`

A pure reducer (mirrors how `OpeningDrillScreen` tracks drill state, but
generalized) so it's unit-testable without React:

```ts
interface LessonRunState {
  stepIndex: number;
  plyIndex: number;               // progress inside current solution line
  chosenSolution: number | null;  // which solution branch the user entered
  fen: string;                    // live position
  phase: 'intro' | 'awaiting-move' | 'animating' | 'feedback-good'
       | 'feedback-bad' | 'step-complete' | 'lesson-complete';
  hintsUsed: number;              // for current step (0 | 1 | 2)
  mistakesThisStep: number;
  firstTryResults: boolean[];     // per challenge → score
  coachText: string;              // what the bubble shows now
}

type LessonEvent =
  | { type: 'START' } | { type: 'NEXT' }
  | { type: 'USER_MOVE'; san: string; verbose: MoveDescriptor }
  | { type: 'AUTO_MOVE_DONE' }
  | { type: 'HINT' } | { type: 'RETRY' };
```

Key transitions:

- `USER_MOVE` on a challenge: match against `goal` (if present) else against
  each solution's next expected user ply → `feedback-good` (apply move,
  queue opponent reply if the line continues) or `feedback-bad` (look up
  `rejections`, else `wrongSay`; undo move after a 1s red flash;
  `mistakesThisStep++`; after 2 mistakes auto-arm the arrow hint).
- `HINT`: `hintsUsed` 0→1 shows `hints[0]`; 1→2 shows `hints[last]` +
  `hintArrows` (fallback: arrow derived from the main line's next user move
  — from/to squares computed by chess.js, so hand-authoring arrows is
  optional).
- Scoring: challenge counts as "first try" iff `mistakesThisStep === 0` and
  `hintsUsed < 2` when completed. Lesson score = firstTry / challenges,
  shown as chess.com-style percentage + 1–3 stars (≥50 % ⭐, ≥80 % ⭐⭐,
  100 % ⭐⭐⭐).

Board interaction, animation timing (700 ms), tap-to-select + legal-move
dots, and good/bad square flashes all reuse the existing `Board` component
and `OpeningDrillScreen` patterns. `Board` needs one small addition:
rendering `arrows` (SVG overlay, same layer as highlights).

## 6. Screens & navigation

Three new routes in `RootStackParamList`:

- `Lessons` — topic grid (icon, title, x/y complete) + "Next Lesson" resume
  card. Entry point: a `NavRow`/card on `HomeScreen` ("Lessons — learn like
  with a coach").
- `LessonTopic: { topicId }` — ordered lesson list with level badge, star
  score, lock state.
- `LessonPlayer: { lessonId }` — the board + coach bubble + prompt chip +
  hint lightbulb + progress bar + Challenge n/m counter. One screen handles
  all step kinds, driven by `LessonEngine`.

Coach presentation: reuse the coach/feedback bubble style from
`FeedbackScreen`/`HintScreen` (speech bubble + avatar), with the
✓ green / ✗ red result chip above the explanation, exactly as in the video.

## 7. Persistence (`StorageService` + `ProgressContext`)

New storage key `lesson_progress`:

```ts
type LessonProgress = Record<string, {
  completed: boolean;
  bestScorePct: number;      // best of all runs
  stars: 0 | 1 | 2 | 3;
  lastStepIndex: number;     // resume mid-lesson
  completedAt?: string;
}>;
```

`ProgressContext` gains `lessonProgress`, `recordLessonStep()` (for resume),
and `completeLesson(lessonId, scorePct)`. "Next Lesson" = first lesson in
`config.ts` order whose progress is incomplete.

## 8. Implementation phases

| Phase | Deliverable | Status |
|-------|------------|--------|
| 1 | This plan; `types.ts`, `config.ts`, `index.ts` registry; validator script | this branch |
| 2 | Knowledge base: Basics + Fundamentals (L1–2) | this branch |
| 3 | Knowledge base: Openings + Tactics (L3–4) | this branch |
| 4 | Knowledge base: Strategy + Endgames (L4–6) | this branch |
| 5 | `LessonEngine.ts` + unit tests against the validator's replay logic | next |
| 6 | Screens (`Lessons`, `LessonTopic`, `LessonPlayer`), `Board` arrows, nav wiring | next |
| 7 | Persistence + Home entry point + polish (sounds, streaks, review-mistakes mode) | next |

Authoring is batched one topic per commit so a broken run resumes at the
last validated batch (`node scripts/validate-lessons.js` must pass before
each commit).

## 9. Content curriculum (what the knowledge base contains)

- **Basics (L1)** — the-rook, the-bishop, the-queen, the-knight, the-pawn,
  the-king-and-check, checkmate-basics, special-moves (castling / en
  passant / promotion). Capture-the-pawns minigames for movement.
- **Fundamentals (L2)** — capture-free-pieces, defend-your-pieces,
  mate-with-two-rooks, mate-with-the-queen, stalemate-and-draw-traps.
- **Openings (L3)** — control-the-center, develop-your-pieces (the video
  lesson), castle-to-safety (the video lesson), punish-early-queen-attacks.
- **Tactics (L3–4)** — forks, pins, skewers, discovered-attacks,
  remove-the-defender, back-rank-mates.
- **Strategy (L4–5)** — open-files-and-rooks, knight-outposts,
  passed-pawns, weak-squares-and-holes.
- **Endgames (L4–6)** — king-and-pawn-endgames, the-opposition,
  rook-endgame-lucena, rook-endgame-philidor, queen-vs-pawn.

~32 lessons, ~5–7 steps each. Every lesson follows the intro → guided →
harder → boss-challenge arc described in §4.
