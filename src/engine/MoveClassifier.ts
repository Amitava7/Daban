import { Chess } from 'chess.js';
import { getEvaluation, getTopMoves } from './ChessEngine';

export type MoveQuality = 'brilliant' | 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export interface MoveAnalysis {
  quality: MoveQuality;
  evalBefore: number;  // centipawns, white-positive
  evalAfter: number;
  bestEval: number;    // best possible eval for this side
  centipawnLoss: number;
  explanation: string;
  coachComment: string;
}

const THRESHOLDS = {
  brilliant: -50,   // player found move that improves eval significantly
  best: 10,
  excellent: 25,
  good: 75,
  inaccuracy: 200,
  mistake: 400,
};

function cpLossToQuality(loss: number, isBrilliant: boolean): MoveQuality {
  if (isBrilliant) return 'brilliant';
  if (loss <= THRESHOLDS.best) return 'best';
  if (loss <= THRESHOLDS.excellent) return 'excellent';
  if (loss <= THRESHOLDS.good) return 'good';
  if (loss <= THRESHOLDS.inaccuracy) return 'inaccuracy';
  if (loss <= THRESHOLDS.mistake) return 'mistake';
  return 'blunder';
}

const EXPLANATIONS: Record<MoveQuality, string[]> = {
  brilliant: [
    'Brilliant! You found a move the engine also prefers — excellent calculation.',
    'Outstanding move. You improved the position significantly.',
    'Creative and strong. This is exactly what the coach would play.',
  ],
  best: [
    'Best move! You found the engine\'s top choice.',
    'Perfect. This is the strongest move in the position.',
    'Precisely right. The position demands this move and you found it.',
  ],
  excellent: [
    'Excellent move. Just a tiny bit below best, but very strong.',
    'Very good. You chose well — only a marginal difference from best.',
    'Strong play. This is nearly optimal.',
  ],
  good: [
    'Good move. Solid, though a slightly better option existed.',
    'Reasonable choice. The position is still fine for you.',
    'Decent. You maintained your advantage.',
  ],
  inaccuracy: [
    'Inaccuracy. This loosens your position slightly — a better move was available.',
    'Small inaccuracy. The position is still okay, but you gave away some edge.',
    'Slightly imprecise. Try to find tighter moves in similar positions.',
  ],
  mistake: [
    'Mistake. This concedes significant advantage to your opponent.',
    'This move hands the initiative to the other side.',
    'A serious error — the position has shifted against you.',
  ],
  blunder: [
    'Blunder! This move loses material or allows a decisive attack.',
    'Critical error — this changes the game drastically.',
    'Major blunder. The opponent now has a winning advantage.',
  ],
};

const COACH_COMMENTS: Record<MoveQuality, string[]> = {
  brilliant: [
    'Brilliant find. I\'m impressed.',
    'That\'s the kind of move that wins games.',
    'Excellent calculation — you saw further than most.',
  ],
  best: [
    'Best move! Your instincts are sharp.',
    'Perfect. That\'s exactly what I\'d play.',
    'You\'re reading the position well.',
  ],
  excellent: [
    'Very solid. Keep the pressure on.',
    'Good play — nearly perfect.',
    'Strong move. The position rewards this kind of precision.',
  ],
  good: [
    'Good, though there was a stronger continuation.',
    'Reasonable choice. The game goes on.',
    'Solid but not the sharpest. Keep looking for forcing moves.',
  ],
  inaccuracy: [
    'A bit imprecise. Watch for tighter options.',
    'You had something better here. Let\'s see how this unfolds.',
    'Small slip — try to stay precise under pressure.',
  ],
  mistake: [
    'That hurts. The opponent now has real chances.',
    'This gives too much away. Stay focused.',
    'A significant error. Let\'s see if you can defend.',
  ],
  blunder: [
    'Big mistake! You\'ve left something hanging.',
    'That\'s a blunder — the opponent wins material.',
    'Ouch. This changes everything. Do you see the problem?',
  ],
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function classifyMove(
  chessBefore: Chess,
  sanPlayed: string,
  evalDepth = 2,
): MoveAnalysis {
  const isWhite = chessBefore.turn() === 'w';

  // Eval before the move
  const evalBefore = getEvaluation(chessBefore, evalDepth);

  // Best possible eval for side to move
  const topMoves = getTopMoves(chessBefore, Math.max(1, evalDepth), 1);
  const bestEval = topMoves.length > 0 ? topMoves[0].score : evalBefore;

  // Make the move
  const chessAfter = new Chess(chessBefore.fen());
  chessAfter.move(sanPlayed);

  // Eval after (negate because it's now opponent's turn)
  const evalAfterRaw = getEvaluation(chessAfter, evalDepth);
  const evalAfter = evalAfterRaw; // white-positive regardless

  // Centipawn loss = how much worse than best move (from side-to-move perspective)
  let cpLoss: number;
  if (isWhite) {
    cpLoss = bestEval - evalAfter;
  } else {
    cpLoss = (-bestEval) - (-evalAfter);
  }

  const isBrilliant = cpLoss < THRESHOLDS.brilliant;
  const quality = cpLossToQuality(Math.max(0, cpLoss), isBrilliant);

  return {
    quality,
    evalBefore,
    evalAfter,
    bestEval,
    centipawnLoss: Math.max(0, cpLoss),
    explanation: pickRandom(EXPLANATIONS[quality]),
    coachComment: pickRandom(COACH_COMMENTS[quality]),
  };
}

export function qualityTone(q: MoveQuality): 'good' | 'warn' | 'bad' | 'brand' {
  if (q === 'brilliant' || q === 'best' || q === 'excellent') return 'good';
  if (q === 'good') return 'brand';
  if (q === 'inaccuracy') return 'warn';
  return 'bad';
}

export function qualityLabel(q: MoveQuality): string {
  const labels: Record<MoveQuality, string> = {
    brilliant: 'Brilliant!',
    best: 'Best',
    excellent: 'Excellent',
    good: 'Good',
    inaccuracy: 'Inaccuracy',
    mistake: 'Mistake',
    blunder: 'Blunder',
  };
  return labels[q];
}

export function formatEval(cp: number): string {
  if (cp >= 9000) return '#';
  if (cp <= -9000) return '-#';
  const pawns = cp / 100;
  return pawns >= 0 ? `+${pawns.toFixed(1)}` : pawns.toFixed(1);
}
