// High-level engine API used across the app, backed entirely by native
// Stockfish. Returns moves in the same shape the screens expect (SAN + from/to
// + White-positive centipawn score), so callers stay simple.
import { Chess } from 'chess.js';
import { Stockfish } from './StockfishUci';
import { dlog } from '../utils/debugLog';

export interface EngineMove {
  san: string;
  from: string;
  to: string;
  promotion?: string;
  score: number; // centipawns, from White's perspective
}

// Convert a side-to-move score to White's perspective using the FEN's turn.
function whitePov(fen: string, scoreCp: number | null, mate: number | null): number {
  const stm = fen.split(' ')[1];
  const cp = mate !== null ? (mate > 0 ? 100000 : -100000) : (scoreCp ?? 0);
  return stm === 'w' ? cp : -cp;
}

// Resolve a UCI move (e.g. "e2e4", "e7e8q") against a FEN into SAN + squares.
function resolve(fen: string, uci: string): Omit<EngineMove, 'score'> | null {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return null;
  try {
    const c = new Chess(fen);
    const mv = c.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci[4] : undefined,
    });
    return { san: mv.san, from: mv.from, to: mv.to, promotion: mv.promotion };
  } catch {
    return null;
  }
}

// Best move at full strength.
export async function bestMove(fen: string, movetimeMs = 1000): Promise<EngineMove | null> {
  if (!Stockfish.available) return null;
  await Stockfish.ensureReady();
  const r = await Stockfish.bestMove(fen, { movetime: movetimeMs, elo: null });
  const m = resolve(fen, r.bestmove);
  return m ? { ...m, score: whitePov(fen, r.scoreCp, r.mate) } : null;
}

// Top N candidate moves (rank 1 = best), via MultiPV.
export async function topMoves(fen: string, n = 3, movetimeMs = 800): Promise<EngineMove[]> {
  if (!Stockfish.available) {
    dlog('hint', 'topMoves: native engine unavailable');
    return [];
  }
  await Stockfish.ensureReady();
  const lines = await Stockfish.searchMulti(fen, { movetime: movetimeMs, multipv: n, elo: null });
  const out: EngineMove[] = [];
  for (const l of lines) {
    const m = resolve(fen, l.uci);
    if (m) out.push({ ...m, score: whitePov(fen, l.scoreCp, l.mate) });
    else dlog('hint', `topMoves: unresolved uci=${l.uci}`);
  }
  dlog('hint', `topMoves fen="${fen.split(' ').slice(0, 2).join(' ')}" rawLines=${lines.length} resolved=${out.length}`);
  return out;
}

// White-positive evaluation of a position, in centipawns.
export async function evaluate(fen: string, movetimeMs = 300): Promise<number> {
  if (!Stockfish.available) return 0;
  await Stockfish.ensureReady();
  const r = await Stockfish.bestMove(fen, { movetime: movetimeMs, elo: null });
  return whitePov(fen, r.scoreCp, r.mate);
}

export interface LineMove {
  san: string;
  from: string;
  to: string;
  fen: string; // position AFTER this move
}

// The engine's principal variation (best play for both sides) from `fen`,
// replayed into per-move frames. A single full-strength search — used for the
// "what you missed" refutation line.
export async function refutationLine(fen: string, maxPlies = 6, movetimeMs = 1200): Promise<LineMove[]> {
  if (!Stockfish.available) return [];
  await Stockfish.ensureReady();
  const r = await Stockfish.searchPv(fen, { movetime: movetimeMs, elo: null });
  const out: LineMove[] = [];
  const c = new Chess(fen);
  for (const uci of r.pv.slice(0, maxPlies)) {
    const m = resolve(c.fen(), uci);
    if (!m) break;
    c.move({ from: m.from, to: m.to, promotion: m.promotion });
    out.push({ san: m.san, from: m.from, to: m.to, fen: c.fen() });
  }
  return out;
}
