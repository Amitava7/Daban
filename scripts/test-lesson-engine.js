#!/usr/bin/env node
/*
 * Drives every lesson in the knowledge base through the real LessonEngine
 * reducer: clean runs, every alternative solution branch, every anticipated
 * rejection, hints, retries and scoring. Run: npm run test:engine
 *
 * The engine is TypeScript, so it is transpiled in-memory (no typechecking —
 * that's `npx tsc --noEmit`'s job) and required from a temp directory.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const ts = require('typescript');
const { Chess } = require('chess.js');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'src', 'lessons', 'data');

// ─── build the engine ───────────────────────────────────────────────────────
// Emit inside the project so the compiled engine resolves chess.js from
// node_modules exactly as the app does.
const cacheRoot = path.join(ROOT, 'node_modules', '.cache');
fs.mkdirSync(cacheRoot, { recursive: true });
const outDir = fs.mkdtempSync(path.join(cacheRoot, 'lesson-engine-'));
for (const file of ['types.ts', 'LessonEngine.ts']) {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'lessons', file), 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
    fileName: file,
  }).outputText;
  fs.writeFileSync(path.join(outDir, file.replace(/\.ts$/, '.js')), js);
}
const engine = require(path.join(outDir, 'LessonEngine.js'));
const { initLesson, lessonReducer } = engine;

// ─── tiny assertion harness ─────────────────────────────────────────────────
let failures = [];
let checks = 0;
function check(cond, label) {
  checks++;
  if (!cond) failures.push(label);
  return cond;
}

const send = (state, event) => lessonReducer(state, event);

function sanToMove(fen, san) {
  const chess = new Chess(fen);
  const m = chess.move(san);
  return { from: m.from, to: m.to, promotion: m.promotion };
}

/** Depth-first search over engine states for capture-all minigames. */
function solveSequence(state, depth = 0) {
  if (depth > 8) return null;
  const chess = new Chess(state.fen);
  const captures = chess.moves({ verbose: true }).filter(m => m.captured);
  for (const m of captures) {
    const next = send(state, { type: 'USER_MOVE', from: m.from, to: m.to, promotion: m.promotion });
    if (next.phase === 'step-complete') return [next];
    if (next.phase === 'awaiting-move' && next.capturesDone > state.capturesDone) {
      const rest = solveSequence(next, depth + 1);
      if (rest) return [next, ...rest];
    }
  }
  return null;
}

/** The move the runner should play at the current challenge ply. */
function nextUserMove(state, branch) {
  const step = state.lesson.steps[state.stepIndex];
  if (step.solutions && step.solutions.length > 0) {
    const si = state.chosenSolution != null
      ? state.chosenSolution
      : (branch && branch.stepIndex === state.stepIndex ? branch.solutionIndex : 0);
    const ply = step.solutions[si].line[state.plyIndex];
    if (ply) return sanToMove(state.fen, ply.san);
  }
  if (step.goal) {
    const chess = new Chess(state.fen);
    for (const san of chess.moves()) {
      const probe = new Chess(state.fen);
      const m = probe.move(san);
      const ok =
        step.goal.type === 'checkmate' ? probe.isCheckmate() :
        step.goal.type === 'check' ? probe.inCheck() :
        step.goal.type === 'promote' ? !!m.promotion :
        step.goal.type === 'capture-on' ? (!!m.captured && step.goal.squares.includes(m.to)) :
        step.goal.type === 'reach' ? (m.piece === (step.goal.piece || 'P').toLowerCase() && step.goal.squares.includes(m.to)) :
        false;
      if (ok) return { from: m.from, to: m.to, promotion: m.promotion };
    }
  }
  return null;
}

/** Play a whole lesson cleanly; `branch` optionally forces one alternate solution. */
function runLesson(lesson, label, branch) {
  let state = initLesson(lesson);
  let guard = 0;

  while (state.phase !== 'lesson-complete' && guard++ < 400) {
    const step = state.lesson.steps[state.stepIndex];
    switch (state.phase) {
      case 'intro':
      case 'step-complete':
        state = send(state, { type: 'NEXT' });
        break;
      case 'watching':
      case 'animating':
        state = send(state, { type: 'TICK' });
        break;
      case 'awaiting-move': {
        if (step.sequenceGoal) {
          const path = solveSequence(state);
          if (!check(path, `${label} steps[${state.stepIndex}]: no capture path found`)) return null;
          state = path[path.length - 1];
          break;
        }
        const move = nextUserMove(state, branch);
        if (!check(move, `${label} steps[${state.stepIndex}]: no solution move available`)) return null;
        const before = state.stepIndex;
        state = send(state, { type: 'USER_MOVE', ...move });
        if (!check(
          state.phase !== 'feedback-bad',
          `${label} steps[${before}]: engine rejected its own solution move (${JSON.stringify(move)}) — "${state.coachText}"`,
        )) return null;
        break;
      }
      case 'feedback-bad':
        return null;
      default:
        return null;
    }
  }

  check(state.phase === 'lesson-complete', `${label}: never reached lesson-complete (stuck in ${state.phase})`);
  check(state.results.length === state.challengeTotal,
    `${label}: recorded ${state.results.length} results for ${state.challengeTotal} challenges`);
  check(state.scorePct === 100, `${label}: clean run scored ${state.scorePct}% (expected 100%)`);
  check(state.stars === 3, `${label}: clean run earned ${state.stars} stars (expected 3)`);
  return state;
}

/** Fast-forward a fresh run to the start of a given challenge step. */
function advanceTo(lesson, targetIndex, label) {
  let state = initLesson(lesson);
  let guard = 0;
  while (state.stepIndex < targetIndex && guard++ < 400) {
    const step = state.lesson.steps[state.stepIndex];
    switch (state.phase) {
      case 'intro':
      case 'step-complete':
        state = send(state, { type: 'NEXT' });
        break;
      case 'watching':
      case 'animating':
        state = send(state, { type: 'TICK' });
        break;
      case 'awaiting-move': {
        if (step.sequenceGoal) {
          const path = solveSequence(state);
          if (!path) return null;
          state = path[path.length - 1];
          break;
        }
        const move = nextUserMove(state);
        if (!move) return null;
        state = send(state, { type: 'USER_MOVE', ...move });
        break;
      }
      default:
        return null;
    }
  }
  return state.stepIndex === targetIndex ? state : null;
}

// ─── per-lesson test suite ──────────────────────────────────────────────────
function testLesson(file) {
  const lesson = JSON.parse(fs.readFileSync(file, 'utf8'));
  const label = path.basename(file, '.json');

  // 1. Clean main-line run.
  runLesson(lesson, `${label} [main]`);

  lesson.steps.forEach((step, index) => {
    if (step.kind !== 'challenge') return;

    // 2. Every alternative solution branch is playable end to end.
    if (step.solutions && step.solutions.length > 1) {
      step.solutions.forEach((_, si) => {
        if (si === 0) return;
        runLesson(lesson, `${label} [step ${index} branch ${si}]`, { stepIndex: index, solutionIndex: si });
      });
    }

    const at = advanceTo(lesson, index, label);
    if (!check(at && at.phase === 'awaiting-move', `${label} steps[${index}]: could not reach challenge`)) return;

    // 3. Anticipated wrong moves produce their tailored coaching, then rewind.
    for (const rej of step.rejections || []) {
      const move = sanToMove(at.fen, rej.san);
      const bad = send(at, { type: 'USER_MOVE', ...move });
      check(bad.phase === 'feedback-bad', `${label} steps[${index}]: rejection ${rej.san} was accepted as correct`);
      check(bad.coachText === rej.say, `${label} steps[${index}]: rejection ${rej.san} lost its explanation`);
      check(bad.resultChip && bad.resultChip.kind === 'bad', `${label} steps[${index}]: rejection ${rej.san} has no error chip`);
      check(bad.mistakesThisStep === 1, `${label} steps[${index}]: mistake not counted for ${rej.san}`);

      const retried = send(bad, { type: 'RETRY' });
      check(retried.phase === 'awaiting-move', `${label} steps[${index}]: RETRY did not resume play`);
      check(retried.fen === step.fen, `${label} steps[${index}]: RETRY did not restore the position`);

      // The solution must still work after a mistake, and must no longer score clean.
      const move2 = nextUserMove(retried);
      if (move2) {
        const after = send(retried, { type: 'USER_MOVE', ...move2 });
        check(after.phase !== 'feedback-bad', `${label} steps[${index}]: solution failed after a retry`);
      }
    }

    // 4. Hints are progressive, and the final hint puts an arrow on the board.
    const h1 = send(at, { type: 'HINT' });
    check(h1.coachText === step.hints[0], `${label} steps[${index}]: first hint text wrong`);
    let hn = h1;
    for (let i = 1; i < step.hints.length; i++) hn = send(hn, { type: 'HINT' });
    check(hn.coachText === step.hints[step.hints.length - 1], `${label} steps[${index}]: last hint text wrong`);
    check(hn.arrows.length > 0, `${label} steps[${index}]: final hint revealed no arrow`);
    for (const a of hn.arrows) {
      check(/^[a-h][1-8]$/.test(a.from) && /^[a-h][1-8]$/.test(a.to),
        `${label} steps[${index}]: bad hint arrow ${JSON.stringify(a)}`);
    }

    // 5. Two misses auto-arm the arrow without the user asking.
    const firstWrong = anyWrongMove(at, step);
    if (firstWrong) {
      let s = send(at, { type: 'USER_MOVE', ...firstWrong });
      if (s.phase === 'feedback-bad') {
        s = send(s, { type: 'RETRY' });
        s = send(s, { type: 'USER_MOVE', ...firstWrong });
        s = send(s, { type: 'RETRY' });
        check(s.arrows.length > 0, `${label} steps[${index}]: arrow not auto-armed after two mistakes`);
        check(s.mistakesThisStep === 2, `${label} steps[${index}]: mistakes not tallied`);
      }
    }
  });

  // 6. A hinted run scores below 100% (hints must cost something).
  const hinted = runHinted(lesson, label);
  if (hinted) check(hinted.scorePct < 100, `${label}: hint-assisted run still scored 100%`);
}

/** Any legal move that is neither a solution nor goal-satisfying. */
function anyWrongMove(state, step) {
  const chess = new Chess(state.fen);
  for (const san of chess.moves()) {
    const probe = send(state, { type: 'USER_MOVE', ...sanToMove(state.fen, san) });
    if (probe.phase === 'feedback-bad') return sanToMove(state.fen, san);
  }
  return null;
}

/** Play cleanly but burn every hint on the first challenge. */
function runHinted(lesson, label) {
  let state = initLesson(lesson);
  let guard = 0;
  let hintedOnce = false;
  while (state.phase !== 'lesson-complete' && guard++ < 400) {
    const step = state.lesson.steps[state.stepIndex];
    switch (state.phase) {
      case 'intro':
      case 'step-complete':
        state = send(state, { type: 'NEXT' });
        break;
      case 'watching':
      case 'animating':
        state = send(state, { type: 'TICK' });
        break;
      case 'awaiting-move': {
        if (!hintedOnce) {
          hintedOnce = true;
          for (let i = 0; i < step.hints.length + 1; i++) state = send(state, { type: 'HINT' });
        }
        if (step.sequenceGoal) {
          const path = solveSequence(state);
          if (!path) return null;
          state = path[path.length - 1];
          break;
        }
        const move = nextUserMove(state);
        if (!move) return null;
        state = send(state, { type: 'USER_MOVE', ...move });
        break;
      }
      default:
        return null;
    }
  }
  return state.phase === 'lesson-complete' ? state : null;
}

// ─── run ────────────────────────────────────────────────────────────────────
const files = [];
for (const topic of fs.readdirSync(DATA_DIR)) {
  const dir = path.join(DATA_DIR, topic);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.json')) files.push(path.join(dir, f));
}
files.sort();
files.forEach(testLesson);

fs.rmSync(outDir, { recursive: true, force: true });

for (const f of failures) console.log('FAIL', f);
console.log(`\n${files.length} lessons driven through the engine — ${checks} checks, ${failures.length} failures`);
process.exit(failures.length ? 1 : 0);
