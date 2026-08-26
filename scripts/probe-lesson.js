#!/usr/bin/env node
/*
 * Position workbench for lesson authors. Every fact you put in a lesson —
 * a FEN, a move order, "this is mate", "this reply is forced" — should come
 * out of this tool, never out of memory.
 *
 *   node scripts/probe-lesson.js game  <moves...>            replay from the initial position
 *   node scripts/probe-lesson.js game  --at 24 <moves...>    ...and print the FEN after 24 plies
 *   node scripts/probe-lesson.js line  <fen> <moves...>      replay a line from a FEN
 *   node scripts/probe-lesson.js san   <fen> <san>           legality + canonical SAN + forced replies
 *   node scripts/probe-lesson.js moves <fen> [--captures]    list legal moves (pick rejections here)
 *   node scripts/probe-lesson.js mate  <fen> [--plies 5]     exhaustive forced-mate search
 *
 * Moves may be given as separate args or one quoted string, with or without
 * move numbers: "1.e4 e5 2.Nf3" and "e4 e5 Nf3" both work. A FEN split across
 * arguments is reassembled, so lost quoting is harmless.
 *
 * Call it directly (`node scripts/probe-lesson.js …`) when passing flags —
 * npm consumes anything starting with `--` unless you write `npm run probe --`.
 * See docs/lessons/VALIDATION.md.
 */
const { Chess } = require('chess.js');

function parseMoves(args) {
  return args
    .join(' ')
    .replace(/\{[^}]*\}/g, '')          // strip PGN comments
    .split(/\s+/)
    .filter(Boolean)
    .filter(t => !/^\d+\.+$/.test(t))    // drop standalone move numbers
    .map(t => t.replace(/^\d+\.(\.\.)?/, ''))
    .filter(t => !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t));
}

function flags(chess, move) {
  const out = [];
  if (chess.isCheckmate()) out.push('CHECKMATE');
  else if (chess.isStalemate()) out.push('STALEMATE');
  else if (chess.inCheck()) out.push('check');
  if (chess.isDraw()) out.push('draw');
  if (move && move.captured) out.push(`captures:${move.captured}`);
  if (move && move.promotion) out.push(`promotion:${move.promotion}`);
  return out.length ? `  [${out.join(' ')}]` : '';
}

/** Replay moves, reporting canonical SAN and flagging any input that differs. */
function replay(chess, moves, { label = 'ply', echo = true, at = null } = {}) {
  let atFen = null;
  for (let i = 0; i < moves.length; i++) {
    let m;
    try {
      m = chess.move(moves[i]);
    } catch {
      console.log(`\n✗ ILLEGAL at ${label} ${i + 1}: "${moves[i]}"`);
      console.log(`  position: ${chess.fen()}`);
      console.log(`  legal:    ${chess.moves().join(' ')}`);
      return { ok: false, atFen };
    }
    const drift = m.san !== moves[i] ? `   (input "${moves[i]}" → canonical "${m.san}")` : '';
    if (echo) console.log(`  ${String(i + 1).padStart(2)}. ${m.san}${flags(chess, m)}${drift}`);
    if (at !== null && i + 1 === at) atFen = chess.fen();
  }
  return { ok: true, atFen };
}

/**
 * Exhaustive forced-mate search. `plies` counts half-moves including the
 * mating move, so a mate in 3 is plies = 5. Returns the principal variation
 * only if EVERY defence is covered.
 */
function findMate(fen, plies) {
  if (plies <= 0) return null;
  const chess = new Chess(fen);
  for (const m of chess.moves()) {
    const after = new Chess(fen);
    after.move(m);
    if (after.isCheckmate()) return [m];
    if (plies >= 3 && !after.isGameOver()) {
      let allCovered = true;
      let line = null;
      for (const reply of after.moves()) {
        const next = new Chess(after.fen());
        next.move(reply);
        const cont = findMate(next.fen(), plies - 2);
        if (!cont) { allCovered = false; break; }
        line = [reply, ...cont];
      }
      if (allCovered && line) return [m, ...line];
    }
  }
  return null;
}

/**
 * Pull a FEN off the front of argv. Quoting is often lost (npm re-splits
 * arguments when forwarding them), so a FEN may arrive as up to six separate
 * tokens — reassemble them.
 */
function takeFen(args) {
  if (!args.length) return '';
  if (!args[0].includes('/')) return args.shift();
  const fen = [args.shift()];
  const fieldPatterns = [/^[wb]$/, /^(-|[KQkq]{1,4})$/, /^(-|[a-h][36])$/, /^\d+$/, /^\d+$/];
  for (const pattern of fieldPatterns) {
    if (args.length && pattern.test(args[0])) fen.push(args.shift());
    else break;
  }
  return fen.join(' ');
}

function takeFlag(args, name, hasValue) {
  const i = args.indexOf(name);
  if (i === -1) return hasValue ? null : false;
  return hasValue ? args.splice(i, 2)[1] : (args.splice(i, 1), true);
}

const [, , cmd, ...rest] = process.argv;

try {
  switch (cmd) {
    case 'game': {
      const at = takeFlag(rest, '--at', true);
      const moves = parseMoves(rest);
      const chess = new Chess();
      console.log(`Replaying ${moves.length} plies from the initial position:`);
      const { ok, atFen } = replay(chess, moves, { at: at ? Number(at) : null });
      if (!ok) process.exit(1);
      if (atFen) console.log(`\nFEN after ${at} plies:\n${atFen}`);
      console.log(`\nFinal FEN:\n${chess.fen()}`);
      break;
    }
    case 'line': {
      const fen = takeFen(rest);
      const moves = parseMoves(rest);
      const chess = new Chess(fen);
      console.log(`Replaying ${moves.length} plies from:\n${fen}\n`);
      const { ok } = replay(chess, moves);
      if (!ok) process.exit(1);
      const last = chess.history({ verbose: true }).filter((_, i) => i % 2 === 0).pop();
      console.log(`\nFinal FEN:\n${chess.fen()}`);
      console.log(`\nSuggested assert for this line: ${
        chess.isCheckmate() ? '"checkmate"'
        : chess.isStalemate() ? '"stalemate"'
        : last && last.promotion ? '"promotion"'
        : chess.inCheck() ? '"check"'
        : last && last.captured ? '"capture"'
        : 'none needed'}`);
      console.log(`Line length ${moves.length} — ${moves.length % 2 === 1 ? 'OK (odd, ends on a user move)' : 'INVALID: must be odd'}`);
      break;
    }
    case 'san': {
      const fen = takeFen(rest);
      const san = rest.shift();
      const chess = new Chess(fen);
      let m;
      try {
        m = chess.move(san);
      } catch {
        console.log(`✗ "${san}" is ILLEGAL here.`);
        console.log(`  legal: ${chess.moves().join(' ')}`);
        process.exit(1);
      }
      console.log(`✓ legal — canonical SAN: ${m.san}${m.san !== san ? `  (you wrote "${san}")` : ''}${flags(chess, m)}`);
      const replies = chess.moves();
      const label = replies.length === 0
        ? ' — none (game over)'
        : replies.length === 1 ? ' — FORCED' : '';
      console.log(`\nOpponent replies (${replies.length})${label}${replies.length ? ':' : ''} ${replies.join(' ')}`);
      console.log(`\nFEN after:\n${chess.fen()}`);
      break;
    }
    case 'moves': {
      const capturesOnly = takeFlag(rest, '--captures', false);
      const chess = new Chess(takeFen(rest));
      let list = chess.moves({ verbose: true });
      if (capturesOnly) list = list.filter(m => m.captured);
      console.log(`${chess.turn() === 'w' ? 'White' : 'Black'} to move — ${list.length} ${capturesOnly ? 'captures' : 'legal moves'}:`);
      console.log(list.map(m => m.san).join(' '));
      break;
    }
    case 'mate': {
      const plies = Number(takeFlag(rest, '--plies', true) || 5);
      const fen = takeFen(rest);
      const pieces = new Chess(fen).board().flat().filter(Boolean).length;
      if (pieces > 12 && plies > 5) {
        console.log(`(heads up: ${pieces} pieces at ${plies} plies may take a while)`);
      }
      const line = findMate(fen, plies);
      if (line) {
        console.log(`✓ FORCED mate in ${(plies + 1) / 2} or fewer: ${line.join(' ')}`);
      } else {
        console.log(`✗ no forced mate within ${plies} plies (mate in ${(plies + 1) / 2}).`);
        console.log(`  If your lesson claims one, the position is wrong — or a defence you missed holds.`);
      }
      break;
    }
    default:
      const header = require('fs').readFileSync(__filename, 'utf8')
        .split('*/')[0]
        .replace(/^#!.*\n/, '')
        .replace(/^\/\*\n?/, '')
        .replace(/^ \* ?/gm, '')
        .trim();
      console.log(header);
      process.exit(cmd ? 1 : 0);
  }
} catch (e) {
  console.log(`error: ${e.message}`);
  process.exit(1);
}
