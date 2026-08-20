#!/usr/bin/env node
/*
 * Validates the lessons knowledge base (src/lessons/data/**\/*.json).
 * Replays every FEN and SAN through chess.js and enforces `assert` claims,
 * so the lesson content is machine-checked. Run: node scripts/validate-lessons.js
 */
const fs = require('fs');
const path = require('path');
const { Chess } = require('chess.js');

const DATA_DIR = path.join(__dirname, '..', 'src', 'lessons', 'data');
const CONFIG_SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'lessons', 'config.ts'), 'utf8');
const INDEX_SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'lessons', 'index.ts'), 'utf8');

const TOPICS = ['basics', 'fundamentals', 'openings', 'tactics', 'strategy', 'endgames'];
const ASSERTS = ['checkmate', 'check', 'capture', 'promotion', 'stalemate', 'draw'];

let errors = [];
let warnings = [];
let lessonCount = 0;
let stepCount = 0;
let challengeCount = 0;

function err(ctx, msg) { errors.push(`${ctx}: ${msg}`); }
function warn(ctx, msg) { warnings.push(`${ctx}: ${msg}`); }

function tryLoadFen(fen, ctx) {
  try {
    return new Chess(fen);
  } catch (e) {
    err(ctx, `invalid FEN "${fen}" — ${e.message}`);
    return null;
  }
}

function tryMove(chess, san, ctx) {
  try {
    return chess.move(san);
  } catch (e) {
    err(ctx, `illegal SAN "${san}" at position ${chess.fen()}`);
    return null;
  }
}

function isSquare(s) { return /^[a-h][1-8]$/.test(s); }

function checkSquares(list, ctx, label) {
  for (const s of list || []) {
    if (!isSquare(s)) err(ctx, `${label} contains invalid square "${s}"`);
  }
}

function checkArrows(list, ctx, label) {
  for (const a of list || []) {
    if (!a || !isSquare(a.from) || !isSquare(a.to)) {
      err(ctx, `${label} contains invalid arrow ${JSON.stringify(a)}`);
    }
  }
}

// Verify the final user move of a replayed line satisfies the assert claim.
function checkAssert(assertName, moveResult, chessAfter, ctx) {
  switch (assertName) {
    case 'checkmate':
      if (!chessAfter.isCheckmate()) err(ctx, `assert "checkmate" failed (position after line: ${chessAfter.fen()})`);
      break;
    case 'check':
      if (!chessAfter.inCheck()) err(ctx, `assert "check" failed`);
      break;
    case 'capture':
      if (!moveResult.captured) err(ctx, `assert "capture" failed — ${moveResult.san} captures nothing`);
      break;
    case 'promotion':
      if (!moveResult.promotion) err(ctx, `assert "promotion" failed — ${moveResult.san} is not a promotion`);
      break;
    case 'stalemate':
      if (!chessAfter.isStalemate()) err(ctx, `assert "stalemate" failed`);
      break;
    case 'draw':
      if (!chessAfter.isDraw()) err(ctx, `assert "draw" failed`);
      break;
    default:
      err(ctx, `unknown assert "${assertName}"`);
  }
}

function moveSatisfiesGoal(goal, m) {
  switch (goal.type) {
    case 'checkmate': {
      return /#$/.test(m.san);
    }
    case 'check':
      return /[+#]$/.test(m.san);
    case 'promote':
      return !!m.promotion;
    case 'capture-on':
      return !!m.captured && goal.squares.includes(m.to);
    case 'reach': {
      const piece = (goal.piece || 'P').toLowerCase();
      return m.piece === piece && goal.squares.includes(m.to);
    }
    default:
      return false;
  }
}

function validateGoal(goal, fen, ctx) {
  const chess = new Chess(fen);
  if (goal.type === 'capture-on' || goal.type === 'reach') {
    checkSquares(goal.squares, ctx, `goal.squares`);
    if (!goal.squares || goal.squares.length === 0) {
      err(ctx, `goal.${goal.type} needs a non-empty squares list`);
      return;
    }
  }
  const legal = chess.moves({ verbose: true });
  const ok = legal.some(m => moveSatisfiesGoal(goal, m));
  if (!ok) err(ctx, `goal "${goal.type}" is unachievable — no legal move satisfies it`);
}

// DFS: can the side to move make `count` consecutive captures (turn handed
// back after each move by rewriting the FEN), never leaving the passive
// side's king in check on its "skipped" turn?
function validateSequenceGoal(seq, fen, ctx) {
  if (seq.type !== 'capture-all') {
    err(ctx, `unknown sequenceGoal type "${seq.type}"`);
    return;
  }
  const start = new Chess(fen);
  const mover = start.turn();
  const enemyPieces = start.board().flat().filter(p => p && p.color !== mover && p.type !== 'k').length;
  if (enemyPieces < seq.count) {
    err(ctx, `sequenceGoal capture-all count=${seq.count} but only ${enemyPieces} capturable enemy pieces on the board`);
    return;
  }
  const flipTurn = (f) => {
    const parts = f.split(' ');
    parts[1] = mover;
    parts[3] = '-'; // clear en passant
    return parts.join(' ');
  };
  const dfs = (f, remaining) => {
    if (remaining === 0) return true;
    let chess;
    try { chess = new Chess(f); } catch { return false; }
    const captures = chess.moves({ verbose: true }).filter(m => m.captured);
    for (const m of captures) {
      const c2 = new Chess(f);
      c2.move(m.san);
      let next;
      try {
        next = new Chess(flipTurn(c2.fen()));
        // Skipping the passive side's turn is only sound if it is not in check.
        const passiveTurn = new Chess(c2.fen());
        if (passiveTurn.inCheck()) continue;
      } catch { continue; }
      if (dfs(next.fen(), remaining - 1)) return true;
    }
    return false;
  };
  if (!dfs(fen, seq.count)) {
    err(ctx, `sequenceGoal capture-all count=${seq.count} cannot be completed by consecutive captures`);
  }
}

function validateLine(sol, fen, ctx) {
  const line = sol.line;
  if (!Array.isArray(line) || line.length === 0) {
    err(ctx, `solution has an empty line`);
    return;
  }
  if (line.length % 2 === 0) {
    err(ctx, `solution line must end on a user move (odd number of plies), got ${line.length}`);
  }
  const chess = tryLoadFen(fen, ctx);
  if (!chess) return;
  let lastUserMove = null;
  for (let i = 0; i < line.length; i++) {
    const ply = line[i];
    if (!ply || typeof ply.san !== 'string') {
      err(ctx, `line[${i}] missing san`);
      return;
    }
    const m = tryMove(chess, ply.san, `${ctx} line[${i}]`);
    if (!m) return;
    if (i % 2 === 0) lastUserMove = m;
  }
  if (sol.assert) {
    if (!ASSERTS.includes(sol.assert)) {
      err(ctx, `unknown assert "${sol.assert}"`);
    } else if (lastUserMove) {
      checkAssert(sol.assert, lastUserMove, chess, ctx);
    }
  }
}

function validateChallenge(step, ctx, stepIdx, totalSteps) {
  challengeCount++;
  if (!step.prompt) err(ctx, `challenge missing prompt`);
  if (!Array.isArray(step.hints) || step.hints.length === 0) {
    err(ctx, `challenge needs at least one hint`);
  }
  const hasSolutions = Array.isArray(step.solutions) && step.solutions.length > 0;
  if (!hasSolutions && !step.goal && !step.sequenceGoal) {
    err(ctx, `challenge needs solutions, a goal, or a sequenceGoal`);
  }
  checkSquares(step.highlights, ctx, 'highlights');
  checkArrows(step.hintArrows, ctx, 'hintArrows');

  const chess = tryLoadFen(step.fen, ctx);
  if (!chess) return;

  if (hasSolutions) {
    const firstMoves = new Set();
    step.solutions.forEach((sol, si) => {
      validateLine(sol, step.fen, `${ctx} solutions[${si}]`);
      if (sol.line && sol.line[0] && sol.line[0].san) firstMoves.add(sol.line[0].san);
    });
    for (const rej of step.rejections || []) {
      const c = new Chess(step.fen);
      const m = tryMove(c, rej.san, `${ctx} rejection`);
      if (!m) continue;
      if (firstMoves.has(rej.san)) err(ctx, `rejection "${rej.san}" is also a solution first move`);
      if (!rej.say) err(ctx, `rejection "${rej.san}" missing say`);
      if (step.goal && moveSatisfiesGoal(step.goal, m)) {
        err(ctx, `rejection "${rej.san}" satisfies the goal — contradictory`);
      }
    }
  }
  if (step.goal) validateGoal(step.goal, step.fen, ctx);
  if (step.sequenceGoal) validateSequenceGoal(step.sequenceGoal, step.fen, ctx);

  // Soft difficulty convention: later challenges shouldn't pre-light squares.
  if (step.highlights && step.highlights.length && stepIdx > totalSteps / 2) {
    warn(ctx, `late-lesson challenge still uses highlights (difficulty ramp convention)`);
  }
}

function validateLesson(file) {
  const rel = path.relative(DATA_DIR, file);
  let lesson;
  try {
    lesson = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    err(rel, `JSON parse error — ${e.message}`);
    return;
  }
  lessonCount++;
  const ctx0 = rel;
  const expectedId = path.basename(file, '.json');
  if (lesson.id !== expectedId) err(ctx0, `id "${lesson.id}" != filename "${expectedId}"`);
  if (!lesson.title) err(ctx0, 'missing title');
  if (!TOPICS.includes(lesson.topic)) err(ctx0, `bad topic "${lesson.topic}"`);
  if (path.basename(path.dirname(file)) !== lesson.topic) {
    err(ctx0, `file is in "${path.basename(path.dirname(file))}/" but topic is "${lesson.topic}"`);
  }
  if (!(lesson.level >= 1 && lesson.level <= 6)) err(ctx0, `level must be 1..6`);
  if (!lesson.subtitle) err(ctx0, 'missing subtitle');
  if (!Array.isArray(lesson.goals) || lesson.goals.length === 0) err(ctx0, 'missing goals');
  if (!Array.isArray(lesson.steps) || lesson.steps.length === 0) {
    err(ctx0, 'missing steps');
    return;
  }
  if (!CONFIG_SRC.includes(`'${lesson.id}'`)) err(ctx0, 'id not listed in config.ts');
  if (!INDEX_SRC.includes(`'${lesson.id}'`)) err(ctx0, 'id not registered in index.ts');

  lesson.steps.forEach((step, i) => {
    stepCount++;
    const ctx = `${rel} steps[${i}]`;
    if (!step.fen) { err(ctx, 'missing fen'); return; }
    switch (step.kind) {
      case 'intro': {
        if (!step.say) err(ctx, 'intro missing say');
        checkSquares(step.highlights, ctx, 'highlights');
        checkArrows(step.arrows, ctx, 'arrows');
        tryLoadFen(step.fen, ctx);
        break;
      }
      case 'explain': {
        if (!step.say) err(ctx, 'explain missing say');
        const chess = tryLoadFen(step.fen, ctx);
        if (!chess) break;
        if (!Array.isArray(step.autoMoves) || step.autoMoves.length === 0) {
          err(ctx, 'explain missing autoMoves');
          break;
        }
        for (let j = 0; j < step.autoMoves.length; j++) {
          if (!tryMove(chess, step.autoMoves[j].san, `${ctx} autoMoves[${j}]`)) break;
        }
        checkSquares(step.highlights, ctx, 'highlights');
        checkArrows(step.arrows, ctx, 'arrows');
        break;
      }
      case 'challenge':
        validateChallenge(step, ctx, i, lesson.steps.length);
        break;
      default:
        err(ctx, `unknown step kind "${step.kind}"`);
    }
  });
}

// ——— run ———
if (!fs.existsSync(DATA_DIR)) {
  console.error('No data directory yet:', DATA_DIR);
  process.exit(1);
}
const files = [];
for (const topic of fs.readdirSync(DATA_DIR)) {
  const dir = path.join(DATA_DIR, topic);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.json')) files.push(path.join(dir, f));
  }
}
files.sort();
files.forEach(validateLesson);

// Registry entries pointing at missing files
const registered = [...INDEX_SRC.matchAll(/'([a-z0-9-]+)':\s*\(\)\s*=>\s*require\('\.\/data\/([a-z]+)\/([a-z0-9-]+)\.json'\)/g)];
for (const [, id, topic, base] of registered) {
  const p = path.join(DATA_DIR, topic, `${base}.json`);
  if (!fs.existsSync(p)) warn('index.ts', `registered lesson "${id}" has no data file yet (${topic}/${base}.json)`);
}

for (const w of warnings) console.log('WARN ', w);
for (const e of errors) console.log('ERROR', e);
console.log(`\n${lessonCount} lessons, ${stepCount} steps (${challengeCount} challenges) — ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
