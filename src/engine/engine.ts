// High-level engine API used across the app, backed entirely by native
// Stockfish. Returns moves in the same shape the screens expect (SAN + from/to
// + White-positive centipawn score), so callers stay simple.
import { Chess } from 'chess.js';
import { Stockfish } from './StockfishUci';

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
  Stockfish.setStrengthElo(null);
  const r = await Stockfish.bestMove(fen, { movetime: movetimeMs });
  const m = resolve(fen, r.bestmove);
  return m ? { ...m, score: whitePov(fen, r.scoreCp, r.mate) } : null;
}

// Top N candidate moves (rank 1 = best), via MultiPV.
export async function topMoves(fen: string, n = 3, movetimeMs = 800): Promise<EngineMove[]> {
  if (!Stockfish.available) return [];
  await Stockfish.ensureReady();
  Stockfish.setStrengthElo(null);
  const lines = await Stockfish.searchMulti(fen, { movetime: movetimeMs, multipv: n });
  const out: EngineMove[] = [];
  for (const l of lines) {
    const m = resolve(fen, l.uci);
    if (m) out.push({ ...m, score: whitePov(fen, l.scoreCp, l.mate) });
  }
  return out;
}

// White-positive evaluation of a position, in centipawns.
export async function evaluate(fen: string, movetimeMs = 300): Promise<number> {
  if (!Stockfish.available) return 0;
  await Stockfish.ensureReady();
  Stockfish.setStrengthElo(null);
  const r = await Stockfish.bestMove(fen, { movetime: movetimeMs });
  return whitePov(fen, r.scoreCp, r.mate);
}
