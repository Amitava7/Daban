// Pure lesson runtime. No React, no timers — the screen owns those and simply
// dispatches events. Keeping this a pure reducer lets scripts/test-lesson-engine.js
// drive every lesson in the knowledge base end to end. See docs/LESSONS_PLAN.md §5.

import { Chess } from 'chess.js';
import {
  Lesson, LessonStep, ChallengeStep, AnnotatedMove, Arrow, ChallengeGoal,
} from './types';

export type LessonPhase =
  | 'intro'            // intro step on screen, waiting for Start/Next
  | 'watching'         // explain step, auto-moves still queued
  | 'awaiting-move'    // challenge: the user must move
  | 'animating'        // opponent reply queued
  | 'feedback-bad'     // wrong move shown, waiting for retry
  | 'step-complete'    // step solved, Next available
  | 'lesson-complete';

export interface CoachChip {
  kind: 'good' | 'bad';
  text: string;
}

export interface BoardHighlight {
  sq: string;
  kind: 'good' | 'bad' | 'warn' | 'brand';
}

export interface LessonRunState {
  lesson: Lesson;
  stepIndex: number;
  phase: LessonPhase;
  /** Live position shown on the board. */
  fen: string;
  /** Position to restore when the user retries the current ply. */
  plyStartFen: string;
  /** Which side the user plays for this step — keeps the board from flipping mid-line. */
  userColor: 'w' | 'b';
  plyIndex: number;
  chosenSolution: number | null;
  capturesDone: number;
  hintsUsed: number;
  mistakesThisStep: number;
  coachText: string;
  resultChip: CoachChip | null;
  highlights: BoardHighlight[];
  arrows: Arrow[];
  lastMove: { from: string; to: string } | null;
  /** Moves the screen should animate, one per TICK. */
  autoQueue: AnnotatedMove[];
  /** One clean/dirty result per completed challenge. */
  results: boolean[];
  challengeIndex: number;
  challengeTotal: number;
  scorePct: number;
  stars: 0 | 1 | 2 | 3;
}

export type LessonEvent =
  | { type: 'NEXT' }
  | { type: 'USER_MOVE'; from: string; to: string; promotion?: string }
  | { type: 'TICK' }
  | { type: 'HINT' }
  | { type: 'RETRY' }
  | { type: 'RESTART' };

/** Delay the screen should wait before dispatching TICK. */
export const AUTO_MOVE_DELAY = 850;
/** Delay before a wrong move is rewound (screen dispatches RETRY). */
export const WRONG_RESET_DELAY = 1700;

// ─── helpers ────────────────────────────────────────────────────────────────

function turnOf(fen: string): 'w' | 'b' {
  return fen.split(' ')[1] === 'b' ? 'b' : 'w';
}

function countChallenges(lesson: Lesson): number {
  return lesson.steps.filter(s => s.kind === 'challenge').length;
}

function challengeNumber(lesson: Lesson, stepIndex: number): number {
  let n = 0;
  for (let i = 0; i <= stepIndex && i < lesson.steps.length; i++) {
    if (lesson.steps[i].kind === 'challenge') n++;
  }
  return n;
}

interface Applied {
  fen: string;
  san: string;
  from: string;
  to: string;
  captured: boolean;
  isCheckmate: boolean;
  isCheck: boolean;
  promotion?: string;
  piece: string;
}

function applyMove(
  fen: string,
  move: string | { from: string; to: string; promotion?: string },
): Applied | null {
  const chess = new Chess(fen);
  let result;
  try {
    result = chess.move(move as never);
  } catch {
    return null;
  }
  if (!result) return null;
  return {
    fen: chess.fen(),
    san: result.san,
    from: result.from,
    to: result.to,
    captured: !!result.captured,
    isCheckmate: chess.isCheckmate(),
    isCheck: chess.inCheck(),
    promotion: result.promotion,
    piece: result.piece,
  };
}

/** Hand the turn straight back to `color` — used by capture-all minigames where
 *  the passive side never replies. */
function keepTurn(fen: string, color: 'w' | 'b'): string {
  const parts = fen.split(' ');
  parts[1] = color;
  parts[3] = '-';
  const next = parts.join(' ');
  try {
    new Chess(next);
    return next;
  } catch {
    return fen;
  }
}

/** Authored SAN is allowed to be sloppy ("Rd8" for what is really "Rd8+"), so
 *  every comparison runs through chess.js to canonicalize first. */
function canonicalSan(fen: string, san: string): string {
  const applied = applyMove(fen, san);
  return applied ? applied.san : san;
}

function goalSatisfied(goal: ChallengeGoal, m: Applied): boolean {
  switch (goal.type) {
    case 'checkmate': return m.isCheckmate;
    case 'check': return m.isCheck;
    case 'promote': return !!m.promotion;
    case 'capture-on': return m.captured && goal.squares.includes(m.to);
    case 'reach': {
      const piece = (goal.piece || 'P').toLowerCase();
      return m.piece === piece && goal.squares.includes(m.to);
    }
    default: return false;
  }
}

function challengeOf(step: LessonStep): ChallengeStep | null {
  return step.kind === 'challenge' ? step : null;
}

/** The move the user is expected to find right now (main line), if any.
 *  Always evaluated against `fen` — the position the user is actually facing,
 *  never a board still showing a rejected move. */
function expectedSan(step: ChallengeStep, state: LessonRunState, fen: string): string | null {
  if (step.solutions && step.solutions.length > 0) {
    const sol = state.chosenSolution != null
      ? step.solutions[state.chosenSolution]
      : step.solutions[0];
    const ply = sol && sol.line[state.plyIndex];
    if (ply) return ply.san;
  }
  if (step.goal) {
    const chess = new Chess(fen);
    for (const cand of chess.moves()) {
      const applied = applyMove(fen, cand);
      if (applied && goalSatisfied(step.goal, applied)) return applied.san;
    }
  }
  return null;
}

function arrowForSan(fen: string, san: string): Arrow | null {
  const applied = applyMove(fen, san);
  return applied ? { from: applied.from, to: applied.to } : null;
}

function guidanceHighlights(step: ChallengeStep): BoardHighlight[] {
  return (step.highlights || []).map(sq => ({ sq, kind: 'warn' as const }));
}

function starsFor(pct: number): 0 | 1 | 2 | 3 {
  if (pct >= 100) return 3;
  if (pct >= 80) return 2;
  if (pct >= 50) return 1;
  return 0;
}

// ─── step entry ─────────────────────────────────────────────────────────────

function enterStep(state: LessonRunState, index: number): LessonRunState {
  const lesson = state.lesson;
  if (index >= lesson.steps.length) return finishLesson(state);

  const step = lesson.steps[index];
  const base: LessonRunState = {
    ...state,
    stepIndex: index,
    fen: step.fen,
    plyStartFen: step.fen,
    userColor: turnOf(step.fen),
    plyIndex: 0,
    chosenSolution: null,
    capturesDone: 0,
    hintsUsed: 0,
    mistakesThisStep: 0,
    resultChip: null,
    arrows: [],
    lastMove: null,
    autoQueue: [],
    highlights: [],
    challengeIndex: challengeNumber(lesson, index),
  };

  if (step.kind === 'intro') {
    return {
      ...base,
      phase: 'intro',
      coachText: step.say,
      highlights: (step.highlights || []).map(sq => ({ sq, kind: 'brand' as const })),
      arrows: step.arrows || [],
    };
  }

  if (step.kind === 'explain') {
    return {
      ...base,
      phase: 'watching',
      coachText: step.say,
      highlights: (step.highlights || []).map(sq => ({ sq, kind: 'brand' as const })),
      arrows: step.arrows || [],
      autoQueue: [...step.autoMoves],
    };
  }

  return {
    ...base,
    phase: 'awaiting-move',
    coachText: step.prompt,
    highlights: guidanceHighlights(step),
  };
}

function finishLesson(state: LessonRunState): LessonRunState {
  const total = state.challengeTotal;
  const clean = state.results.filter(Boolean).length;
  const pct = total > 0 ? Math.round((clean / total) * 100) : 100;
  return {
    ...state,
    phase: 'lesson-complete',
    resultChip: null,
    highlights: [],
    arrows: [],
    autoQueue: [],
    scorePct: pct,
    stars: starsFor(pct),
    coachText: pct === 100
      ? 'Perfect run — every challenge solved first try!'
      : pct >= 50
        ? 'Lesson complete. Replay it any time to raise your score.'
        : 'Lesson complete — a replay will make these patterns stick.',
  };
}

/** Mark the current challenge finished and move to the step-complete phase. */
function completeChallenge(state: LessonRunState, step: ChallengeStep, say: string): LessonRunState {
  const clean = state.mistakesThisStep === 0 && state.hintsUsed < 2;
  return {
    ...state,
    phase: 'step-complete',
    results: [...state.results, clean],
    coachText: step.successSay || say,
    arrows: [],
  };
}

// ─── reducer ────────────────────────────────────────────────────────────────

export function initLesson(lesson: Lesson): LessonRunState {
  const seed: LessonRunState = {
    lesson,
    stepIndex: 0,
    phase: 'intro',
    fen: lesson.steps[0] ? lesson.steps[0].fen : 'start',
    plyStartFen: lesson.steps[0] ? lesson.steps[0].fen : 'start',
    userColor: 'w',
    plyIndex: 0,
    chosenSolution: null,
    capturesDone: 0,
    hintsUsed: 0,
    mistakesThisStep: 0,
    coachText: '',
    resultChip: null,
    highlights: [],
    arrows: [],
    lastMove: null,
    autoQueue: [],
    results: [],
    challengeIndex: 0,
    challengeTotal: countChallenges(lesson),
    scorePct: 0,
    stars: 0,
  };
  return enterStep(seed, 0);
}

export function lessonReducer(state: LessonRunState, event: LessonEvent): LessonRunState {
  const step = state.lesson.steps[state.stepIndex];

  switch (event.type) {
    case 'RESTART':
      return initLesson(state.lesson);

    case 'NEXT': {
      if (state.phase === 'intro' || state.phase === 'step-complete') {
        return enterStep(state, state.stepIndex + 1);
      }
      return state;
    }

    case 'TICK': {
      if (state.autoQueue.length === 0) return state;
      const [next, ...rest] = state.autoQueue;
      const applied = applyMove(state.fen, next.san);
      if (!applied) return { ...state, autoQueue: [] };

      const advanced: LessonRunState = {
        ...state,
        fen: applied.fen,
        lastMove: { from: applied.from, to: applied.to },
        highlights: [],
        arrows: [],
        autoQueue: rest,
        coachText: next.say || state.coachText,
      };

      if (state.phase === 'watching') {
        return rest.length === 0
          ? { ...advanced, phase: 'step-complete' }
          : advanced;
      }

      // Opponent reply inside a challenge line.
      const challenge = challengeOf(step);
      if (!challenge) return advanced;

      const plyIndex = state.plyIndex + 2;
      const sol = state.chosenSolution != null && challenge.solutions
        ? challenge.solutions[state.chosenSolution]
        : null;
      const lineDone = !sol || plyIndex >= sol.line.length;

      if (lineDone) {
        return completeChallenge({ ...advanced, plyIndex }, challenge, advanced.coachText);
      }
      return {
        ...advanced,
        phase: 'awaiting-move',
        plyIndex,
        plyStartFen: applied.fen,
        resultChip: null,
        coachText: next.say || challenge.prompt,
      };
    }

    case 'HINT': {
      const challenge = challengeOf(step);
      if (!challenge || (state.phase !== 'awaiting-move' && state.phase !== 'feedback-bad')) return state;
      const hintsUsed = state.hintsUsed + 1;
      const text = challenge.hints[Math.min(hintsUsed - 1, challenge.hints.length - 1)];
      const revealArrow = hintsUsed >= challenge.hints.length;
      let arrows = state.arrows;
      if (revealArrow) {
        if (challenge.hintArrows && challenge.hintArrows.length > 0) {
          arrows = challenge.hintArrows;
        } else {
          const san = expectedSan(challenge, state, state.plyStartFen);
          const arrow = san ? arrowForSan(state.plyStartFen, san) : null;
          arrows = arrow ? [arrow] : arrows;
        }
      }
      return { ...state, hintsUsed, coachText: text, arrows };
    }

    case 'RETRY': {
      const challenge = challengeOf(step);
      if (!challenge || state.phase !== 'feedback-bad') return state;
      // Two misses: put the arrow on the board without waiting for another tap.
      let arrows = state.arrows;
      let hintsUsed = state.hintsUsed;
      if (state.mistakesThisStep >= 2 && arrows.length === 0) {
        hintsUsed = Math.max(hintsUsed, challenge.hints.length);
        if (challenge.hintArrows && challenge.hintArrows.length > 0) {
          arrows = challenge.hintArrows;
        } else {
          const san = expectedSan(challenge, state, state.plyStartFen);
          const arrow = san ? arrowForSan(state.plyStartFen, san) : null;
          arrows = arrow ? [arrow] : arrows;
        }
      }
      return {
        ...state,
        phase: 'awaiting-move',
        fen: state.plyStartFen,
        resultChip: null,
        highlights: state.plyIndex === 0 ? guidanceHighlights(challenge) : [],
        coachText: state.mistakesThisStep >= 2 && challenge.hints.length > 0
          ? challenge.hints[challenge.hints.length - 1]
          : challenge.prompt,
        hintsUsed,
        arrows,
        lastMove: null,
      };
    }

    case 'USER_MOVE': {
      const challenge = challengeOf(step);
      if (!challenge || state.phase !== 'awaiting-move') return state;

      const applied = applyMove(state.fen, {
        from: event.from,
        to: event.to,
        promotion: event.promotion || 'q',
      });
      if (!applied) return state;

      // 1. capture-all minigames: any capture keeps the run going.
      if (challenge.sequenceGoal) {
        if (applied.captured) {
          const capturesDone = state.capturesDone + 1;
          const done = capturesDone >= challenge.sequenceGoal.count;
          const moved: LessonRunState = {
            ...state,
            capturesDone,
            fen: done ? applied.fen : keepTurn(applied.fen, state.userColor),
            lastMove: { from: applied.from, to: applied.to },
            highlights: [{ sq: applied.to, kind: 'good' }],
            arrows: [],
            resultChip: { kind: 'good', text: `${applied.san} is correct` },
          };
          if (done) return completeChallenge(moved, challenge, challenge.successSay || 'Well done!');
          return {
            ...moved,
            plyStartFen: keepTurn(applied.fen, state.userColor),
            coachText: challenge.sequenceGoal.say
              || `${capturesDone} of ${challenge.sequenceGoal.count} — keep going!`,
          };
        }
        return wrongMove(state, challenge, applied);
      }

      // 2. Scripted solution lines.
      if (challenge.solutions && challenge.solutions.length > 0) {
        const candidates = state.chosenSolution != null
          ? [state.chosenSolution]
          : challenge.solutions.map((_, i) => i);

        for (const si of candidates) {
          const sol = challenge.solutions[si];
          const ply = sol.line[state.plyIndex];
          if (!ply || canonicalSan(state.fen, ply.san) !== applied.san) continue;

          const reply = sol.line[state.plyIndex + 1];
          const moved: LessonRunState = {
            ...state,
            chosenSolution: si,
            fen: applied.fen,
            lastMove: { from: applied.from, to: applied.to },
            highlights: [{ sq: applied.to, kind: 'good' }],
            arrows: [],
            resultChip: { kind: 'good', text: `${applied.san} is correct` },
            coachText: ply.say || 'Correct!',
          };
          if (reply) {
            return { ...moved, phase: 'animating', autoQueue: [reply] };
          }
          return completeChallenge({ ...moved, plyIndex: state.plyIndex + 1 }, challenge, moved.coachText);
        }
      }

      // 3. Open-ended goal.
      if (challenge.goal && goalSatisfied(challenge.goal, applied)) {
        const moved: LessonRunState = {
          ...state,
          fen: applied.fen,
          lastMove: { from: applied.from, to: applied.to },
          highlights: [{ sq: applied.to, kind: 'good' }],
          arrows: [],
          resultChip: { kind: 'good', text: `${applied.san} is correct` },
          coachText: 'Correct!',
        };
        return completeChallenge(moved, challenge, moved.coachText);
      }

      return wrongMove(state, challenge, applied);
    }

    default:
      return state;
  }
}

function wrongMove(state: LessonRunState, challenge: ChallengeStep, applied: Applied): LessonRunState {
  const rejection = (challenge.rejections || [])
    .find(r => canonicalSan(state.fen, r.san) === applied.san);
  return {
    ...state,
    phase: 'feedback-bad',
    fen: applied.fen,
    lastMove: { from: applied.from, to: applied.to },
    highlights: [{ sq: applied.to, kind: 'bad' }],
    arrows: [],
    mistakesThisStep: state.mistakesThisStep + 1,
    resultChip: { kind: 'bad', text: `${applied.san} is incorrect` },
    coachText: rejection
      ? rejection.say
      : challenge.wrongSay || 'Not quite — think again about what the position needs.',
  };
}

// ─── view helpers ───────────────────────────────────────────────────────────

/** Legal destination squares for a piece the user picked up. */
export function legalTargets(fen: string, from: string): string[] {
  try {
    const chess = new Chess(fen);
    return chess.moves({ square: from as never, verbose: true }).map((m: { to: string }) => m.to);
  } catch {
    return [];
  }
}

/** True when moving from→to is a pawn move landing on the promotion rank. */
export function isPromotion(fen: string, from: string, to: string): boolean {
  try {
    const chess = new Chess(fen);
    return chess.moves({ square: from as never, verbose: true })
      .some((m: { to: string; promotion?: string }) => m.to === to && !!m.promotion);
  } catch {
    return false;
  }
}

/** What sits on a square right now — used to decide if the user may pick it up. */
export function pieceAt(fen: string, sq: string): { type: string; color: 'w' | 'b' } | null {
  try {
    const chess = new Chess(fen);
    const piece = chess.get(sq as never) as { type: string; color: 'w' | 'b' } | undefined;
    return piece ? { type: piece.type, color: piece.color } : null;
  } catch {
    return null;
  }
}

export function sideToMoveLabel(state: LessonRunState): string {
  return state.userColor === 'w' ? 'White to Move' : 'Black to Move';
}
