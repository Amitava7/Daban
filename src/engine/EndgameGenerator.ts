import { Chess } from 'chess.js';

export type EndgameCategory = 'basic_mates' | 'pawn_endings' | 'rook_endings' | 'minor_pieces';

export interface EndgamePuzzle {
  id: string;
  category: EndgameCategory;
  title: string;
  description: string;
  goal: string;
  fen: string;
  playerSide: 'w' | 'b';
  hint?: string;
}

// Fixed curated endgame positions
const CURATED: EndgamePuzzle[] = [
  // Basic Mates
  {
    id: 'kq_k1', category: 'basic_mates',
    title: 'K + Q vs K', description: 'The most basic checkmate. Drive the king to the edge.',
    goal: 'Checkmate in a few moves.',
    fen: '8/8/8/8/8/3K4/8/Q3k3 w - - 0 1',
    playerSide: 'w',
    hint: 'Use your queen to restrict the king, then bring your king close.',
  },
  {
    id: 'kr_k1', category: 'basic_mates',
    title: 'K + R vs K', description: 'Lawnmower technique — cut off the king rank by rank.',
    goal: 'Force checkmate with king and rook.',
    fen: '8/8/8/8/8/2K5/8/R3k3 w - - 0 1',
    playerSide: 'w',
    hint: 'Cut off the black king with your rook, then bring your king.',
  },
  {
    id: 'kbb_k1', category: 'basic_mates',
    title: 'K + 2 Bishops vs K', description: 'Two bishops control all colors — drive king to corner.',
    goal: 'Checkmate the lone king.',
    fen: '8/8/8/8/8/2K5/8/B1B1k3 w - - 0 1',
    playerSide: 'w',
    hint: 'Drive the king to the corner where one bishop covers the escape squares.',
  },
  {
    id: 'kq_k2', category: 'basic_mates',
    title: 'K + Q vs K (defending)', description: 'Can you avoid stalemate while mating?',
    goal: 'Checkmate without stalemating.',
    fen: '8/8/8/8/8/8/6K1/Q6k w - - 0 1',
    playerSide: 'w',
    hint: 'Beware of stalemate! Give the black king a square to move to before closing in.',
  },
  {
    id: 'k2r_k1', category: 'basic_mates',
    title: 'K + 2 Rooks vs K', description: 'Rolling rooks — the easiest basic mate.',
    goal: 'Checkmate with two rooks.',
    fen: '8/8/8/8/8/2K5/8/RR2k3 w - - 0 1',
    playerSide: 'w',
    hint: 'Use the rooks on alternating ranks like a lawnmower.',
  },

  // Pawn Endings
  {
    id: 'kpk_square', category: 'pawn_endings',
    title: 'K + P vs K — The Square Rule', description: 'Can the defending king catch the pawn?',
    goal: 'Promote the pawn.',
    fen: '8/8/8/4k3/8/8/4P3/4K3 w - - 0 1',
    playerSide: 'w',
    hint: 'If the black king is outside the "square" of the pawn, it cannot catch it. Push!',
  },
  {
    id: 'kpk_opp', category: 'pawn_endings',
    title: 'K + P vs K — Opposition', description: 'Key squares and opposition decide the game.',
    goal: 'Use the king to escort the pawn to promotion.',
    fen: '8/8/4k3/8/4K3/8/4P3/8 w - - 0 1',
    playerSide: 'w',
    hint: 'Get your king to e5, d6, or f6. These are the "key squares" for the e-pawn.',
  },
  {
    id: 'kpk_rp', category: 'pawn_endings',
    title: 'Rook Pawn Exception', description: 'Rook pawns don\'t always win!',
    goal: 'Try to promote — but beware the stalemate trap.',
    fen: '8/8/7k/8/8/7K/7P/8 w - - 0 1',
    playerSide: 'w',
    hint: 'The h-pawn is special. The defending king only needs to reach h8 for a draw!',
  },
  {
    id: 'pp_passedpawn', category: 'pawn_endings',
    title: 'Passed Pawn Breakthrough', description: 'Create a passed pawn from multiple pawns.',
    goal: 'Find the breakthrough that creates an unstoppable passer.',
    fen: '8/8/8/2k1p3/2p5/8/2PPP3/3K4 w - - 0 1',
    playerSide: 'w',
    hint: 'Look for a pawn sacrifice that creates an unstoppable passed pawn.',
  },
  {
    id: 'kpk_zugzwang', category: 'pawn_endings',
    title: 'Zugzwang in Pawn Endings', description: 'The side that must move loses.',
    goal: 'Win using zugzwang.',
    fen: '8/8/8/8/8/4k3/4p3/4K3 b - - 0 1',
    playerSide: 'b',
    hint: 'You have a pawn on e2. Promote it while the white king is forced to give way.',
  },
  {
    id: 'pawn_race', category: 'pawn_endings',
    title: 'Pawn Race', description: 'Both sides have a passed pawn — who queens first?',
    goal: 'Queen first and use the resulting queen ending to win.',
    fen: '8/1p6/8/8/8/8/6P1/8 w - - 0 1',
    playerSide: 'w',
    hint: 'Calculate carefully — who queens first, and does the resulting position win?',
  },
  {
    id: 'outside_passer', category: 'pawn_endings',
    title: 'Outside Passed Pawn', description: 'A pawn on the wing distracts the enemy king.',
    goal: 'Win using the outside passed pawn as a decoy.',
    fen: '8/8/8/5k2/8/3K4/P4p2/8 w - - 0 1',
    playerSide: 'w',
    hint: 'Use your a-pawn to lure the black king away, then your king wins the f-pawn.',
  },
  {
    id: 'shouldering', category: 'pawn_endings',
    title: 'King Shouldering', description: 'Cut off the opposing king with your own.',
    goal: 'Use your king to block the enemy king from the critical area.',
    fen: '8/8/8/8/3k4/8/3P4/3K4 w - - 0 1',
    playerSide: 'w',
    hint: 'Race your king to the promotion square while preventing the black king from interfering.',
  },

  // Rook Endings
  {
    id: 'lucena', category: 'rook_endings',
    title: 'Lucena Position', description: 'The most important rook ending — bridge building.',
    goal: 'Build a bridge to shelter your king and promote the pawn.',
    fen: '1K6/1P6/8/8/8/2k5/4r3/5R2 w - - 0 1',
    playerSide: 'w',
    hint: 'Build a bridge with your rook. Play Rf4 to cut off the black rook\'s checking distance.',
  },
  {
    id: 'philidor', category: 'rook_endings',
    title: 'Philidor Position', description: 'The key defensive drawing technique.',
    goal: 'Draw as the weaker side using the Philidor method.',
    fen: '8/8/8/3k4/3p4/8/8/3KR3 b - - 0 1',
    playerSide: 'b',
    hint: 'Keep your rook on the third rank, switch to checking from behind only when the pawn advances.',
  },
  {
    id: 'rook_cut', category: 'rook_endings',
    title: 'Rook Cutoff', description: 'Cut off the enemy king with your rook.',
    goal: 'Win by using your rook to restrict the black king.',
    fen: '8/4k3/8/3R4/8/8/4K3/4r3 w - - 0 1',
    playerSide: 'w',
    hint: 'Cut off the black king along a rank or file to prevent it from approaching your king.',
  },
  {
    id: 'rook_pawn1', category: 'rook_endings',
    title: 'Rook + Pawn vs Rook', description: 'The defender must use the Philidor or Lucena technique.',
    goal: 'Win with the extra pawn.',
    fen: '8/8/8/8/3k4/8/3P4/K2R4 w - - 0 1',
    playerSide: 'w',
    hint: 'Advance the pawn with king support. Use your rook to drive the black king away.',
  },
  {
    id: 'rook_active', category: 'rook_endings',
    title: 'Active Rook', description: 'An active rook behind enemy pawns wins.',
    goal: 'Win with the active rook behind the passed pawn.',
    fen: '8/1r6/8/1p6/8/8/1P1K4/1R6 w - - 0 1',
    playerSide: 'w',
    hint: 'Keep your rook active and behind the opposing pawn. Activity is key in rook endings.',
  },
  {
    id: 'rook_king1', category: 'rook_endings',
    title: 'Beating Back Checks', description: 'Using the king to escape checks.',
    goal: 'Win despite constant checks by marching the king forward.',
    fen: '8/8/8/8/8/8/R7/K1k5 w - - 0 1',
    playerSide: 'w',
    hint: 'Use your king to help — don\'t just shuffle your rook. The king can escape checks by marching away.',
  },

  // Minor Pieces
  {
    id: 'bishop_pair', category: 'minor_pieces',
    title: 'The Bishop Pair', description: 'Two bishops dominate in open positions.',
    goal: 'Win using the power of the bishop pair in an open position.',
    fen: '8/8/4k3/8/5B2/4B3/4K3/8 w - - 0 1',
    playerSide: 'w',
    hint: 'Coordinate both bishops to control diagonals. Drive the king to a corner.',
  },
  {
    id: 'wrong_bishop', category: 'minor_pieces',
    title: 'Wrong Color Bishop', description: 'Bishop + rook pawn can be a draw!',
    goal: 'Understand why this is a draw and how the defender holds.',
    fen: '8/8/8/7k/7P/8/7K/7B w - - 0 1',
    playerSide: 'w',
    hint: 'The bishop doesn\'t control h8. The defending king only needs to reach that corner!',
  },
  {
    id: 'knight_vs_bishop', category: 'minor_pieces',
    title: 'Knight vs Bishop', description: 'Knights excel in closed positions.',
    goal: 'Win with knight vs bishop in this closed structure.',
    fen: '8/8/3k4/2p1p3/2P1P3/8/3K4/4N3 w - - 0 1',
    playerSide: 'w',
    hint: 'The pawns are fixed! The knight can reach both flanks, the bishop is restricted.',
  },
  {
    id: 'bn_mate', category: 'minor_pieces',
    title: 'Bishop + Knight Mate', description: 'The hardest basic mate — requires precise technique.',
    goal: 'Checkmate with bishop and knight. Drive king to the right corner.',
    fen: '8/8/8/8/8/2K5/8/B2Nk3 w - - 0 1',
    playerSide: 'w',
    hint: 'Drive the king to a corner matching your bishop color. Use the W-maneuver with the knight.',
  },
];

export function getPuzzlesByCategory(category: EndgameCategory): EndgamePuzzle[] {
  return CURATED.filter(p => p.category === category);
}

export function getPuzzleById(id: string): EndgamePuzzle | undefined {
  return CURATED.find(p => p.id === id);
}

export function getAllPuzzles(): EndgamePuzzle[] {
  return CURATED;
}

export const CATEGORY_META: Record<EndgameCategory, { name: string; total: number }> = {
  basic_mates: { name: 'Basic mates', total: 5 },
  pawn_endings: { name: 'Pawn endings', total: 8 },
  rook_endings: { name: 'Rook endings', total: 6 },
  minor_pieces: { name: 'Minor pieces', total: 4 },
};

// Generate a random endgame position for a category (engine-generated style)
export function generateRandomPosition(category: EndgameCategory, chess: Chess): string {
  const puzzles = getPuzzlesByCategory(category);
  const random = puzzles[Math.floor(Math.random() * puzzles.length)];
  return random.fen;
}
