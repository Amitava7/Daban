# Authoring lessons

Sourcing material, designing the arc, and writing the JSON.
Prerequisite: [README.md](README.md). Verification lives in
[VALIDATION.md](VALIDATION.md).

---

## 1. Sourcing material

### Where material comes from

| Source | Use for | Notes |
|---|---|---|
| **Master games** | Combination and attacking lessons with a story | Web-search the score, cross-check **two** sources, then replay it |
| **Composed studies** | Endgame ideas at their purest | Réti, Saavedra, Troitsky; positions are tiny and fully verifiable |
| **Named patterns** | Mating nets, tactical motifs | You construct the position yourself — see *Constructed positions* below |
| **Opening theory** | Traps, refutations, move-order lessons | Verify the trap actually works; most "traps" online are misremembered |
| **Puzzle databases** | Bulk tactical drills | The Lichess CC0 puzzle DB (`database.lichess.org`) is ideal, **but it was blocked by this environment's network egress policy**. Check availability before planning around it |

### Check for duplicates before you author

Do this **before** sourcing, not after writing. Ids and titles are checked by
the validator, so those never collide — but that is not where duplication
happens. **Duplicated content hides as one challenge inside a lesson with an
unrelated name.** Four of a planned twenty lessons were dropped this way, each
caught only by reading the existing solution lines:

| Planned lesson | Already covered by | How it hid |
|---|---|---|
| Blackburne–Shilling trap | `opening-traps/gambit-traps` | It *is* that lesson's first challenge; the title says "Queen-Raid Gambits" |
| Legal's Mate | `tactics/pins` | The whole `Nxe5 Bxd1 Bxf7+ Ke7 Nd5#` combination, as the last challenge |
| Underpromotion | `opening-traps/lasker-trap` **and** `masterpieces/immortal-studies` | Knight underpromotion in one, the Saavedra rook promotion in the other |
| Epaulette mate | `mating-patterns/more-mating-nets` **and** `spot-the-mate` | A `Qe6#` / `Qd6#` mate-in-one in each — the pattern is never named in either |

The listing of lesson titles will not save you. Dump the actual solution lines
and grep the signature moves:

```bash
# every challenge FEN + solution line in the knowledge base
python3 - <<'PY'
import json, glob
for f in sorted(glob.glob('src/lessons/data/*/*.json')):
    d = json.load(open(f))
    for s in d['steps']:
        if s['kind'] == 'challenge':
            for sol in s.get('solutions', []):
                print(d['id'], '|', ' '.join(m['san'] for m in sol['line']))
PY

# and grep the moves that identify your idea
grep -rl "Nd5#\|Qxg3#\|=N" src/lessons/data/
grep -ril "fried liver\|traxler\|englund" src/lessons/data/
```

Also read the `goals` array of any lesson in the same neighbourhood — a theme
is often claimed there without appearing in a title. `remove-the-defender`
lists "Exploit pinned and overloaded defenders" and "Combine deflection with
the back rank", which is why a separate *Deflection* lesson would have been
redundant.

### Getting a game score right

Prose descriptions of famous games are unreliable — truncated, transposed, or
typo'd. The procedure that works:

1. Web-search for the move list (`"Player A" "Player B" year full moves`).
2. Cross-check a second, independent source.
3. **Replay it**: `node scripts/probe-lesson.js game "e4 e5 Nf3 ..."`. If it replays clean to
   the known finish, the score is right. If it throws, one of your sources is
   wrong — search again, don't patch by guessing.
4. Extract the FENs you need with `--at N` (N = number of *plies*, so White's
   move 25 is `--at 48`).

Never hand-write a FEN for a real-game position. Generate it.

### Constructed positions

For named patterns you invent the position. Two rules:

- **It must be legal**: both kings present, kings never adjacent, the side not
  to move not in check. `node scripts/probe-lesson.js moves <fen>` fails loudly otherwise.
- **The intended solution must be the *only* solution.** Run
  `node scripts/probe-lesson.js mate <fen> --plies N`. This catches the trap that bit us
  repeatedly: a position built to teach a 9-move combination that happens to
  contain a mate in 1, so the lesson's "correct" answer is objectively second
  best. Move a piece and re-probe until the search returns your line.

#### Prefer a real game — the reliability gap is enormous

Across the second and third batches the split was stark, and it is the single
most useful planning fact in this document:

| Material | First-check pass rate |
|---|---|
| Web-sourced game scores, replayed | **Effectively all** — Lasker–Thomas, Steinitz–von Bardeleben, Zukertort–Blackburne, Adams–Torre, Réti–Tartakower, Reshevsky–Petrosian and every trap line replayed clean |
| Positions constructed by hand | **Poor, and it degrades with the pattern's difficulty** — about a third of the simpler nets in the first build had a flaw; for minor-piece mates in the later batches, *every* hand-built attempt failed its first machine check |

Sourcing is cheap and near-certain; construction is expensive and usually
wrong. **Budget accordingly: reach for a real game first, and treat a
constructed position as work, not as a shortcut.** Concrete failures, all from
confident-feeling drafts:

- A "Novotny" interference position where **Black was already in check** from a
  queen on an open g-file — an illegal position, with White to move.
- A knight-mate net that assumed a knight on `g6` covers `h7`. It does not: a
  knight on g6 reaches e5, e7, f4, f8, h4, h8.
- A two-bishop mate where two natural-looking moves (`Ba3`, `Bh6`) are
  **stalemate**, not progress.

Verify legality for **both** sides. Checking only "is the side to move in
check" misses the illegal case, which is the side *not* to move being in check:

```js
const w = new Chess(fen), b = new Chess(fen.replace(' w ', ' b '));
const legal = !w.inCheck() && !b.inCheck();   // both must be false
```

#### Derive the position from a search, not from a diagram in your head

When a pattern really does need a constructed position, let a solver find it.
Enumerate candidates and filter for the property you want, rather than drafting
a position and hoping. Breadth is the thing to get right:

- **Fix the kings, enumerate the rest.** Pinning the black king to a corner and
  the white king to a handful of plausible squares, then sweeping the remaining
  two pieces over all 64, returns bishop-and-knight mating nets in seconds.
- **Unconstrained random search is a trap.** A sweep for "a position with a
  unique forced mate whose key move is a quiet sacrifice" ran for five minutes
  and found nothing; the same budget spent on a narrow enumeration succeeded
  immediately.
- Filter on `mates.length === 1` to guarantee the lesson's answer is *the*
  answer, and require the defender to have at least one legal move so the
  position is not already stalemate.

#### If you cannot verify it, drop it

A planned *Interference* lesson was cut for exactly this reason: the geometry
failed every construction attempt, the one famous practical example sat on
domains this environment's egress policy blocks, and reconstructing it from a
prose description would have meant asserting a position no tool had confirmed.
Shipping it would have broken the non-negotiable rule at the top of
`README.md`. **A missing lesson is a gap; a wrong lesson teaches something
false.** Cut it, say so plainly, and leave a note for whoever tries next.

### Curating for the audience

The current audience is **~1000+ elo**. That rules out piece movement, "what is
check", and one-move hangs. A challenge earns its place when:

- the natural, obvious move **fails for a concrete reason** you can show, and
- the right move rests on a *named, transferable* idea, and
- the failure mode is one a real player at that level actually commits.

The most valuable challenges are the ones where a plausible move loses on the
spot — that's what the `rejections` field is for, and it's where most of the
teaching happens.

### Attribution and rights

Move scores are facts and carry no copyright — replay them freely, and name the
players, event and year (it's good pedagogy and good manners). **Annotation
prose is copyrighted**: never lift commentary from books, chess sites, or
video transcripts. Write the coaching voice yourself.

---

## 2. Anatomy of a lesson file

One file per lesson: `src/lessons/data/<topic>/<lesson-id>.json`. The `id`
must equal the filename, and the file must sit in the directory matching its
`topic` — the validator enforces both.

```jsonc
{
  "id": "anastasias-mate",          // == filename, == config.ts entry
  "title": "Anastasia's Mate",
  "topic": "mating-patterns",       // == parent directory
  "level": 5,                        // 1–6 difficulty band
  "subtitle": "Knight seals the escape, queen sac opens the h-file.",
  "goals": ["...", "...", "..."],   // 2–4 bullets, shown on the intro step
  "estMinutes": 7,
  "steps": [ /* … */ ]
}
```

`src/lessons/types.ts` is the authoritative schema. Below is how to *use* it.

---

## 3. Designing the arc

A lesson is a short story: **show the idea, then make them earn it.**

```
intro       →  Name the pattern. State the preconditions. Point at the key squares.
explain     →  (optional) Auto-play the idea once so it's seen before it's demanded.
challenge   →  Guided: concrete prompt, `highlights` lit, short line.
challenge   →  Unguided: conceptual prompt, no highlights, longer line.
challenge   →  Boss: "find the best move", full combination, no scaffolding.
intro       →  (optional) Coda: the transferable rule, or how to defend against it.
```

### The difficulty ramp

Three levers, all encoded in data:

1. **Prompt specificity** — "Capture the knight on d5" → "Develop with a
   threat" → "Find the best move."
2. **Scaffolding** — `highlights` on early challenges only. The validator
   *warns* if a challenge past the lesson midpoint still lights squares.
3. **Line length** — 1 ply early, 5–13 plies at the end. Long lines are the
   main thing that makes a lesson feel advanced; a 13-ply challenge (the
   Torre–Lasker windmill) plays like a real combination because it *is* one.

### Multi-step challenges

Even indices are the user's moves; odd indices are opponent replies the app
auto-plays. Lines must therefore have an **odd length** and end on a user move.

```jsonc
"solutions": [{
  "line": [
    { "san": "Ne7+", "say": "The seal — g8 and g6 are both covered." },  // user
    { "san": "Kh8" },                                                     // auto
    { "san": "Qxh7+", "say": "The queen gives herself to open the file." },
    { "san": "Kxh7" },
    { "san": "Rh3#", "say": "Anastasia's Mate." }
  ],
  "assert": "checkmate"
}]
```

Prefer **forced** replies for the opponent's moves — check them with
`node scripts/probe-lesson.js san <fen> <move>`, which prints the reply count and says
`FORCED` when there is exactly one. A line built on a non-forced reply teaches
a sequence the opponent can simply decline, which is a lie; if you must use
one, pick the critical try and say so in the coaching text.

### Alternative solutions and open goals

- Several genuinely good first moves → give each its own entry in `solutions`;
  the engine locks onto whichever branch the user enters and each carries its
  own coaching.
- Many valid answers (any mate, any promotion, any capture on a square) → use
  a `goal` instead of enumerating: `{"type":"checkmate"}`, `{"type":"promote"}`,
  `{"type":"capture-on","squares":["d5"]}`, `{"type":"check"}`,
  `{"type":"reach","squares":["h8"],"piece":"Q"}`.
- A `goal` only accepts moves reachable **in one move**. Attaching
  `{"type":"checkmate"}` to a step whose mate is three moves away makes the
  step unsolvable — the validator catches this as *"goal is unachievable"*.
- Repeated captures against a passive side → `sequenceGoal`
  (`{"type":"capture-all","count":3}`).

---

## 4. Writing the coaching voice

The coach is a patient tutor who explains **why**, never a quizmaster.

**Prompts** ask a question and imply the method:
> "Develop your bishop to attack a black knight."

**Hints** escalate, and never simply give the answer first:
1. Socratic — reframe the position ("Which black piece defends e5?").
2. Concrete — name the square or the method. The last hint also reveals the
   board arrow.

**`say` on a correct move** confirms, explains the point, then generalizes:
> "Exactly — the bishop pressures the c6 knight, the defender of e5, so your
> attack grows indirectly. Development with venom."

**`rejections` are the heart of the lesson.** Each names the refutation
concretely, then states the lesson:
> `"d4"` → *"Black wins a pawn! After exd4, e5 and the c5-bishop gang up… Try a
> safer pawn move to free your queenside bishop."*

Rules for rejections:

- Must be **legal** in that exact position — probe every one. This was the
  single most common authoring error in the first build (~10 occurrences).
- Must not be a solution's first move, and must not satisfy the `goal`.
- Should be a move a real player would actually try. A rejection for an absurd
  move teaches nothing.
- Anything not listed falls back to `wrongSay`, so write that too.

**`successSay`** closes the step with the transferable principle — the sentence
you want remembered a month later.

### Style rules

- Second person, active voice. Name patterns explicitly ("Anastasia's Mate",
  "zwischenzug") — vocabulary is part of the teaching.
- Concrete over vague: "the f7 pawn is defended only by the king", not "this is
  risky".
- Never leave reasoning artifacts in shipped text — no "wait, no…",
  "hmm", "actually". Grep for them before committing; a stray one shipped in
  the first build and had to be patched.
- Historical colour is welcome and memorable ("published by Damiano in 1512",
  "the spectators showered the board with gold coins") — as long as it's true.

---

## 5. Adding a new topic

Four files, all required:

1. `src/lessons/types.ts` — add the id to the `TopicId` union.
2. `src/lessons/config.ts` — add a `TOPICS` entry (id, title, emoji icon,
   description, `order`) and the lesson metadata to `LESSONS`.
3. `src/lessons/index.ts` — add `require()` entries to `REGISTRY`.
4. `scripts/validate-lessons.js` — add the id to the `TOPICS` array.

Hyphenated topic ids are fine (`mating-patterns`) — just make sure any regex
you touch allows the hyphen. A regex that read `[a-z]+` for the topic segment
silently excluded two whole topics from a registry check for an entire build.

---

## 6. Registration order matters

**Write the JSON file first. Register it second. Never the reverse.**

Metro resolves every `require()` when bundling the release APK, so a registry
entry whose file doesn't exist yet fails the Android build — about eight
minutes into CI, with the error buried in Gradle output. The validator now
treats a missing registered file as an error so you catch it locally in two
seconds, but the discipline is simpler: don't register what you haven't
written.

Lesson order inside `LESSONS` is the **unlock order** — lesson *n+1* opens when
*n* is completed. Order deliberately: each lesson should only need what came
before it.

---

## 7. Worked example

Adding one lesson end to end:

```bash
P=scripts/probe-lesson.js

# 1. Source and verify the game score
node $P game "d4 Nf6 Nf3 e6 Bg5 c5 e3 cxd4 exd4 Be7 ..."
#    → replays clean and prints the final FEN, so the score is real

# 2. Extract the position before the key move (White's 25th move = 48 plies)
node $P game --at 48 "d4 Nf6 Nf3 e6 ..."
#    → r3rnk1/pb3pp1/3pp2p/1q4BQ/1P1P4/4N1R1/P4PPP/4R1K1 w - - 4 25

# 3. Confirm the combination, and check which replies are forced
node $P line "r3rnk1/pb3pp1/3pp2p/1q4BQ/1P1P4/4N1R1/P4PPP/4R1K1 w - - 4 25" \
             "Bf6 Qxh5 Rxg7+ Kh8 Rxf7+ Kg8 Rg7+"
node $P san  "r3rnk1/pb3pp1/3pp2p/1q4BQ/1P1P4/4N1R1/P4PPP/4R1K1 w - - 4 25" "Bf6"

# 4. Choose a plausible wrong move for a rejection — and prove it's legal
node $P moves "r3rnk1/pb3pp1/3pp2p/1q4BQ/1P1P4/4N1R1/P4PPP/4R1K1 w - - 4 25"
node $P san   "r3rnk1/pb3pp1/3pp2p/1q4BQ/1P1P4/4N1R1/P4PPP/4R1K1 w - - 4 25" "Qxb5"

# 5. Write src/lessons/data/masterpieces/torre-lasker-windmill.json
# 6. Register it in config.ts + index.ts (file first, registration second)
# 7. Gate it
npm run validate:lessons && npm run test:engine
```
