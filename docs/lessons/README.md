# Lessons authoring guide

How to add lessons to the Daban chess coach — written for whoever (or
whatever) picks this up next. It encodes what worked, and what broke, while
building the first 90 lessons.

| Document | Read it when |
|---|---|
| **[AUTHORING.md](AUTHORING.md)** | Choosing material and writing the lesson JSON |
| **[VALIDATION.md](VALIDATION.md)** | Verifying positions, running the gates, debugging failures |
| [../LESSONS_PLAN.md](../LESSONS_PLAN.md) | Understanding the runtime architecture |

## The system in one paragraph

A lesson is a JSON file: a metadata header plus an ordered list of **steps**.
Three step kinds — `intro` (the coach talks), `explain` (moves auto-play as a
demonstration), and `challenge` (the user must find a move). A challenge holds
one or more **solution lines** where even-indexed plies are the user's moves
and odd-indexed plies are the opponent's automatic replies, so a single
challenge can teach a 13-move combination. Wrong moves are met by
**rejections** — anticipated mistakes with tailored coaching. The runtime
(`src/lessons/LessonEngine.ts`) is generic: **adding lessons requires no code
changes**, only data plus registration.

## Non-negotiable rule

> Every chess claim in a lesson must be produced by a tool, not by memory.

FENs, move orders, "this is mate", "this reply is forced", "this capture
loses" — all of it comes out of `node scripts/probe-lesson.js` (see
VALIDATION.md). Models
recall famous games *approximately*; approximate chess is wrong chess, and
wrong chess in a teaching app is worse than no lesson. Roughly a third of the
positions drafted from memory in the first build had a flaw the tools caught.

## Workflow

```
0. DE-DUPE    Dump existing solution lines; grep your idea     → AUTHORING.md §1
1. SOURCE     Pick material, find the real move score          → AUTHORING.md §1
2. VERIFY     Replay it; extract FENs at decision points       → probe-lesson.js
3. DESIGN     Choose the step arc and difficulty ramp          → AUTHORING.md §3
4. WRITE      Author the JSON (one file per lesson)            → AUTHORING.md §4
5. REGISTER   config.ts + index.ts (only after the file exists) → AUTHORING.md §6
6. VALIDATE   npm run validate:lessons && npm run test:engine  → VALIDATION.md
7. SHIP       Commit per topic batch; CI builds the APK        → VALIDATION.md §5
```

Step 0 is not optional and is not the validator's job. Ids and titles never
collide, but **content duplicates hide as a single challenge inside a
differently-named lesson** — four of a planned twenty were dropped that way.

Author in batches of one topic, and run steps 6–7 per batch. Every push builds
a full release APK (~25 min), so a broken batch is expensive; a validated one
is free.

## Definition of done

- [ ] `npm run validate:lessons` — **0 errors**
- [ ] `npm run test:engine` — **0 failures**
- [ ] The idea is **not already taught** inside another lesson's challenges
- [ ] Every rejection was probed and is legal *and* instructive
- [ ] Every `assert` claim comes from a probe, not an assumption
- [ ] The lesson is registered in `config.ts` **and** `index.ts`
- [ ] New topic? Also added to `types.ts` and the validator's `TOPICS`
- [ ] Coaching text names the pattern and states a transferable principle
- [ ] No self-correcting prose ("wait, no…") left in any `say`/`hint`

## Task template for an agent

Paste this, filling the brackets:

> Add a `[topic]` lesson set to the Daban lessons knowledge base. Read
> `docs/lessons/README.md`, `AUTHORING.md` and `VALIDATION.md` first and follow
> them exactly.
>
> Audience: **[~1200 elo]**. Level band **[4–5]**. Author **[4]** lessons,
> each with **[4–6]** steps, and at least one challenge per lesson whose
> solution line is **[7+]** plies deep.
>
> Source material from **[real master games / composed studies / named
> patterns]**. Verify every position and line with the probe tool before
> writing it (`node scripts/probe-lesson.js`) — never from memory. Cross-check game scores against two
> independent sources.
>
> Gates: `npm run validate:lessons` and `npm run test:engine` must both be
> clean before each commit. Commit one topic batch at a time.

## Current state

90 lessons across 10 topics · 403 steps · 241 challenges · deepest challenge
13 plies. Every topic holds 8–10 lessons. Validator: 0 errors, 2 intentional
style warnings. Engine suite: 6045 checks.

### Known gaps

- **Interference / Novotny** — attempted and deliberately cut; no verified
  position was reachable (see AUTHORING.md §1, *If you cannot verify it, drop
  it*). Still an open slot for anyone who can source or derive one.
- Mating patterns is the thinnest topic by *new* material: the 9 lessons there
  already cover epaulette, smothered, Arabian, Damiano, Boden, Anastasia, the
  Greek gift, rook-and-knight, rook-and-bishop, queen-and-pawn,
  queen-and-knight and doubled rooks on the seventh. Check §1's de-dupe recipe
  carefully before adding there.
