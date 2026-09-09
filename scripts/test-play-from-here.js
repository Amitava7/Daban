#!/usr/bin/env node
/*
 * Guards the "play from here" affordance: every lesson step's board must be
 * either a real, playable position the coach can take over, or a genuinely
 * finished one (mate/stalemate) where the button correctly hides itself.
 *
 * Also checks the handoff rules the GameContext relies on — who moves first,
 * and that the position survives a load/play round trip. Run: npm run test:play
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const { Chess } = require('chess.js');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'src', 'lessons', 'data');

// ─── build the engine (same trick as test-lesson-engine.js) ─────────────────
const cacheRoot = path.join(ROOT, 'node_modules', '.cache');
fs.mkdirSync(cacheRoot, { recursive: true });
const outDir = fs.mkdtempSync(path.join(cacheRoot, 'play-from-here-'));
for (const file of ['types.ts', 'LessonEngine.ts']) {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'lessons', file), 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
    fileName: file,
  }).outputText;
  fs.writeFileSync(path.join(outDir, file.replace(/\.ts$/, '.js')), js);
}
const engine = require(path.join(outDir, 'LessonEngine.js'));
const { initLesson, lessonReducer, isPlayablePosition } = engine;

let failures = [];
let checks = 0;
function check(cond, label) {
  checks++;
  if (!cond) failures.push(label);
  return cond;
}

function loadLessons() {
  const out = [];
  for (const topic of fs.readdirSync(DATA_DIR)) {
    const dir = path.join(DATA_DIR, topic);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
      out.push({
        rel: `${topic}/${file}`,
        lesson: JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')),
      });
    }
  }
  return out;
}

// ─── 1. every step FEN is classified correctly ──────────────────────────────
let playable = 0;
let finished = 0;
for (const { rel, lesson } of loadLessons()) {
  lesson.steps.forEach((step, i) => {
    const ctx = `${rel} steps[${i}]`;
    const offered = isPlayablePosition(step.fen);

    // The FEN must load at all — the validator already enforces this, so a
    // false here means isPlayablePosition is rejecting a good position.
    let chess = null;
    try { chess = new Chess(step.fen); } catch { chess = null; }
    check(chess !== null, `${ctx}: FEN does not load`);
    if (!chess) return;

    const reallyOver = chess.isGameOver() || chess.moves().length === 0;
    check(offered === !reallyOver, `${ctx}: offered=${offered} but gameOver=${reallyOver}`);

    if (offered) {
      playable++;
      // A position we offer must survive the handoff: reload it, and both
      // sides' king counts must be intact or the coach has nothing to play.
      const reload = new Chess(step.fen);
      check(reload.fen() === chess.fen(), `${ctx}: FEN not stable across reload`);
      const board = step.fen.split(' ')[0];
      check((board.match(/K/g) || []).length === 1, `${ctx}: not exactly one white king`);
      check((board.match(/k/g) || []).length === 1, `${ctx}: not exactly one black king`);
    } else {
      finished++;
    }
  });
}

// ─── 2. the handoff rules GameContext applies ───────────────────────────────
// startNewGame lets the coach move first exactly when the position's side to
// move is not the player's colour.
const HANDOFF = [
  { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', as: 'w', engineFirst: false },
  { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', as: 'b', engineFirst: true },
  { fen: '8/8/3k4/8/8/8/BB3K2/8 w - - 0 1', as: 'w', engineFirst: false },
  { fen: '8/8/3k4/8/8/8/BB3K2/8 w - - 0 1', as: 'b', engineFirst: true },
  { fen: '8/8/8/3k4/8/3B4/4N3/4K3 w - - 0 1', as: 'w', engineFirst: false },
];
for (const c of HANDOFF) {
  const chess = new Chess(c.fen);
  check(chess.turn() !== c.as === c.engineFirst,
    `handoff ${c.fen} as ${c.as}: engine-first should be ${c.engineFirst}`);
  // And the game must actually be playable for both sides from there.
  check(chess.moves().length > 0, `handoff ${c.fen}: no legal moves`);
}

// ─── 3. rejects what it should ──────────────────────────────────────────────
const REJECT = [
  ['not a fen at all', 'garbage'],
  ['checkmated position', '7k/8/6K1/8/8/8/BB6/8 b - - 1 1'],
  ['stalemated position', '7k/8/6K1/8/8/7B/B7/8 b - - 1 1'],
];
for (const [label, fen] of REJECT) {
  check(isPlayablePosition(fen) === false, `should reject ${label}: ${fen}`);
}

// ─── 4. the regression this feature exists for ──────────────────────────────
// mate-with-two-bishops used to end on a slide promising fifty moves of
// practice that the lesson could not deliver. Drive it to that final step and
// assert the position there is now handed off to a real game.
{
  const lesson = JSON.parse(fs.readFileSync(
    path.join(DATA_DIR, 'fundamentals', 'mate-with-two-bishops.json'), 'utf8'));
  let st = initLesson(lesson);
  st = lessonReducer(st, { type: 'NEXT' });               // intro -> challenge
  const c = new Chess(st.fen);
  const m = c.move('Bb2');
  st = lessonReducer(st, { type: 'USER_MOVE', from: m.from, to: m.to });
  st = lessonReducer(st, { type: 'NEXT' });               // -> explain
  let guard = 0;
  while (st.autoQueue.length && guard++ < 10) st = lessonReducer(st, { type: 'TICK' });
  st = lessonReducer(st, { type: 'NEXT' });               // -> final slide

  check(st.stepIndex === lesson.steps.length - 1, 'two-bishops: not on the final step');
  check(st.phase === 'intro', `two-bishops: final step phase is ${st.phase}`);
  check(isPlayablePosition(st.fen), 'two-bishops: final slide offers no playable position');
  check(!/fifty moves the rules allow/.test(st.coachText),
    'two-bishops: final slide still promises practice it does not run');
  check(/Play here/.test(st.coachText),
    'two-bishops: final slide does not point at the play-from-here button');

  // The promised mate is genuinely reachable from that slide's position.
  const board = new Chess(st.fen);
  check(board.turn() === 'w', 'two-bishops: final slide is not White to move');
  check(board.moves().length > 20, 'two-bishops: final slide position looks wrong');
}

// ─── 5. every step of every lesson offers the button unless truly over ──────
// A lesson where NO step is playable would mean the affordance never appears.
for (const { rel, lesson } of loadLessons()) {
  const any = lesson.steps.some(s => isPlayablePosition(s.fen));
  check(any, `${rel}: no step offers a playable position`);
}

console.log(`\n${playable} playable step positions, ${finished} finished ` +
  `— ${checks} checks, ${failures.length} failures`);
if (failures.length) {
  for (const f of failures.slice(0, 25)) console.log(`  FAIL  ${f}`);
  if (failures.length > 25) console.log(`  ...and ${failures.length - 25} more`);
  process.exit(1);
}
