import { Chess } from 'chess.js';

// Piece values in centipawns
const PIECE_VALUES: Record<string, number> = {
  p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000,
};

// Piece-square tables (from white's perspective, board[0] = rank 8 → PST row 0)
// For white: PST[boardRank][file], for black: PST[7-boardRank][file]
const PST: Record<string, number[][]> = {
  p: [
    [ 0,  0,  0,  0,  0,  0,  0,  0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [ 5,  5, 10, 25, 25, 10,  5,  5],
    [ 0,  0,  0, 20, 20,  0,  0,  0],
    [ 5, -5,-10,  0,  0,-10, -5,  5],
    [ 5, 10, 10,-20,-20, 10, 10,  5],
    [ 0,  0,  0,  0,  0,  0,  0,  0],
  ],
  n: [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30],
    [-30,  5, 10, 15, 15, 10,  5,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50],
  ],
  b: [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10],
    [-10, 10, 10, 10, 10, 10, 10,-10],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20],
  ],
  r: [
    [ 0,  0,  0,  0,  0,  0,  0,  0],
    [ 5, 10, 10, 10, 10, 10, 10,  5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [ 0,  0,  0,  5,  5,  0,  0,  0],
  ],
  q: [
    [-20,-10,-10, -5, -5,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5,  5,  5,  5,  0,-10],
    [ -5,  0,  5,  5,  5,  5,  0, -5],
    [  0,  0,  5,  5,  5,  5,  0, -5],
    [-10,  5,  5,  5,  5,  5,  0,-10],
    [-10,  0,  5,  0,  0,  0,  0,-10],
    [-20,-10,-10, -5, -5,-10,-10,-20],
  ],
  k: [
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20],
    [-10,-20,-20,-20,-20,-20,-20,-10],
    [ 20, 20,  0,  0,  0,  0, 20, 20],
    [ 20, 30, 10,  0,  0, 10, 30, 20],
  ],
  k_end: [
    [-50,-40,-30,-20,-20,-30,-40,-50],
    [-30,-20,-10,  0,  0,-10,-20,-30],
    [-30,-10, 20, 30, 30, 20,-10,-30],
    [-30,-10, 30, 40, 40, 30,-10,-30],
    [-30,-10, 30, 40, 40, 30,-10,-30],
    [-30,-10, 20, 30, 30, 20,-10,-30],
    [-30,-30,  0,  0,  0,  0,-30,-30],
    [-50,-30,-30,-30,-30,-30,-30,-50],
  ],
};

function isEndgame(chess: Chess): boolean {
  let queens = 0, minors = 0;
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r][f];
      if (!p) continue;
      if (p.type === 'q') queens++;
      if (p.type === 'n' || p.type === 'b' || p.type === 'r') minors++;
    }
  }
  return queens === 0 || (queens <= 2 && minors <= 2);
}

function evaluate(chess: Chess): number {
  if (chess.isCheckmate()) return chess.turn() === 'w' ? -100000 : 100000;
  if (chess.isDraw()) return 0;

  const board = chess.board();
  const endgame = isEndgame(chess);
  let score = 0;

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f];
      if (!piece) continue;
      const { type, color } = piece;
      const val = PIECE_VALUES[type] ?? 0;
      let pstKey = type;
      if (type === 'k' && endgame) pstKey = 'k_end';
      const pstRow = PST[pstKey];
      const pstVal = pstRow ? (color === 'w' ? pstRow[r][f] : pstRow[7 - r][f]) : 0;
      score += color === 'w' ? val + pstVal : -(val + pstVal);
    }
  }

  return score;
}

// Lightweight search instrumentation. negamax increments a node counter so
// the move pipeline can log how much work a single coach move actually cost on
// the real device (see GameContext.runEngineMove). Zero-cost when unused.
let searchNodes = 0;
export function resetSearchNodes(): void { searchNodes = 0; }
export function getSearchNodes(): number { return searchNodes; }

// Negamax with alpha-beta: returns score relative to side to move
function negamax(chess: Chess, depth: number, alpha: number, beta: number): number {
  searchNodes++;
  if (depth === 0) {
    const raw = evaluate(chess);
    return chess.turn() === 'w' ? raw : -raw;
  }
  if (chess.isCheckmate()) return -100000 - depth;
  if (chess.isDraw()) return 0;

  const moves = chess.moves({ verbose: true });

  // Move ordering: captures > promotions > others (by MVV-LVA)
  moves.sort((a, b) => {
    const aScore = (a.captured ? PIECE_VALUES[a.captured] - PIECE_VALUES[a.piece] / 10 : 0) +
                   (a.promotion ? PIECE_VALUES[a.promotion] : 0);
    const bScore = (b.captured ? PIECE_VALUES[b.captured] - PIECE_VALUES[b.piece] / 10 : 0) +
                   (b.promotion ? PIECE_VALUES[b.promotion] : 0);
    return bScore - aScore;
  });

  let maxScore = -Infinity;
  for (const move of moves) {
    chess.move(move);
    const score = -negamax(chess, depth - 1, -beta, -alpha);
    chess.undo();
    if (score > maxScore) maxScore = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return maxScore;
}

export function levelToDepth(level: number): number {
  if (level <= 2) return 1;
  if (level <= 4) return 2;
  if (level <= 6) return 3;
  if (level <= 8) return 4;
  return 4; // cap at 4 for performance
}

const LEVEL_ELOS = [600, 700, 850, 1000, 1100, 1250, 1400, 1550, 1700, 1900];

export function levelToElo(level: number): number {
  return LEVEL_ELOS[Math.min(level - 1, 9)];
}

// Pick the engine level whose rating is closest to the given Elo, so the
// coach plays at roughly the same strength as the player.
export function eloToLevel(elo: number): number {
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < LEVEL_ELOS.length; i++) {
    const diff = Math.abs(LEVEL_ELOS[i] - elo);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best + 1;
}

export interface EngineResult {
  san: string;
  from: string;
  to: string;
  promotion?: string;
  score: number; // centipawns, from white's perspective
}

export function getBestMove(chess: Chess, depth: number): EngineResult {
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) throw new Error('No legal moves');

  // Shuffle for variety at shallow depths
  if (depth <= 1 && moves.length > 1) {
    for (let i = moves.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [moves[i], moves[j]] = [moves[j], moves[i]];
    }
  }

  // Sort captures first for better pruning
  moves.sort((a, b) => {
    const aScore = a.captured ? PIECE_VALUES[a.captured] ?? 0 : 0;
    const bScore = b.captured ? PIECE_VALUES[b.captured] ?? 0 : 0;
    return bScore - aScore;
  });

  let bestMove = moves[0];
  let bestScore = -Infinity;
  const isWhite = chess.turn() === 'w';

  for (const move of moves) {
    chess.move(move);
    const score = -negamax(chess, depth - 1, -Infinity, Infinity);
    chess.undo();
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  // bestScore is from side-to-move perspective; convert to white-positive
  const whiteScore = isWhite ? bestScore : -bestScore;

  return {
    san: bestMove.san,
    from: bestMove.from,
    to: bestMove.to,
    promotion: bestMove.promotion,
    score: whiteScore,
  };
}

// Get top N moves with scores (for hint screen)
export function getTopMoves(chess: Chess, depth: number, n = 3): EngineResult[] {
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return [];
  const isWhite = chess.turn() === 'w';
  const d = Math.max(1, depth - 1); // slightly faster for hints

  const scored = moves.map(move => {
    chess.move(move);
    const score = -negamax(chess, d, -Infinity, Infinity);
    chess.undo();
    const whiteScore = isWhite ? score : -score;
    return { move, score: whiteScore };
  });

  scored.sort((a, b) => (isWhite ? b.score - a.score : a.score - b.score));

  return scored.slice(0, n).map(({ move, score }) => ({
    san: move.san,
    from: move.from,
    to: move.to,
    promotion: move.promotion,
    score,
  }));
}

// Get evaluation of current position in centipawns (white-positive)
export function getEvaluation(chess: Chess, depth = 2): number {
  if (chess.isGameOver()) {
    if (chess.isCheckmate()) return chess.turn() === 'w' ? -10000 : 10000;
    return 0;
  }
  const isWhite = chess.turn() === 'w';
  const score = negamax(chess, depth, -Infinity, Infinity);
  return isWhite ? score : -score;
}

// Get refutation line (best opponent response sequence)
export function getRefutationLine(
  chess: Chess,
  moves: string[],
  depth = 3,
): string[] {
  const clone = new Chess(chess.fen());
  const line: string[] = [];
  for (let i = 0; i < moves.length; i++) {
    const result = getBestMove(clone, Math.max(1, depth - i));
    line.push(result.san);
    clone.move({ from: result.from, to: result.to, promotion: result.promotion });
  }
  return line;
}
