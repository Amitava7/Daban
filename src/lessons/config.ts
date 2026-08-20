// Topic and lesson registry. Menus render from this file alone; step data is
// loaded per-lesson through src/lessons/index.ts. Order within each topic is
// the unlock order (finish lesson n to unlock n+1). See docs/LESSONS_PLAN.md.

import { Topic, LessonMeta } from './types';

export const TOPICS: Topic[] = [
  {
    id: 'basics',
    title: 'Chess Basics',
    icon: '♟️',
    description: 'How every piece moves, checks, and the first checkmates.',
    order: 1,
  },
  {
    id: 'fundamentals',
    title: 'Winning the Game',
    icon: '🏆',
    description: 'Capture safely, defend well, and finish with basic mates.',
    order: 2,
  },
  {
    id: 'openings',
    title: 'Openings',
    icon: '📖',
    description: 'Center control, fast development, and a safe king.',
    order: 3,
  },
  {
    id: 'tactics',
    title: 'Tactics',
    icon: '⚔️',
    description: 'Forks, pins, skewers, and the patterns that win material.',
    order: 4,
  },
  {
    id: 'strategy',
    title: 'Strategy',
    icon: '🧠',
    description: 'Open files, outposts, pawn play — plans beyond one move.',
    order: 5,
  },
  {
    id: 'endgames',
    title: 'Endgames',
    icon: '👑',
    description: 'Convert your advantage: pawn races, opposition, rook endings.',
    order: 6,
  },
];

/** Ordered per topic — index order is unlock order. */
export const LESSONS: LessonMeta[] = [
  // ——— Chess Basics (Level 1) ———
  { id: 'the-rook', topic: 'basics', level: 1, estMinutes: 3,
    title: 'The Rook',
    subtitle: 'Straight lines, long range — meet your heavy piece.' },
  { id: 'the-bishop', topic: 'basics', level: 1, estMinutes: 3,
    title: 'The Bishop',
    subtitle: 'Diagonals only, and always the same color squares.' },
  { id: 'the-queen', topic: 'basics', level: 1, estMinutes: 3,
    title: 'The Queen',
    subtitle: 'Rook plus bishop in one — your strongest piece.' },
  { id: 'the-knight', topic: 'basics', level: 1, estMinutes: 4,
    title: 'The Knight',
    subtitle: 'The L-shaped jumper that ignores walls.' },
  { id: 'the-pawn', topic: 'basics', level: 1, estMinutes: 4,
    title: 'The Pawn',
    subtitle: 'Small steps forward, captures sideways, dreams of promotion.' },
  { id: 'the-king-and-check', topic: 'basics', level: 1, estMinutes: 4,
    title: 'The King and Check',
    subtitle: 'One square at a time — and how to answer a check.' },
  { id: 'checkmate-basics', topic: 'basics', level: 1, estMinutes: 5,
    title: 'Checkmate!',
    subtitle: 'End the game: your first mate-in-one puzzles.' },
  { id: 'special-moves', topic: 'basics', level: 1, estMinutes: 5,
    title: 'Special Moves',
    subtitle: 'Castling, en passant, and pawn promotion.' },

  // ——— Winning the Game (Level 2) ———
  { id: 'capture-free-pieces', topic: 'fundamentals', level: 2, estMinutes: 4,
    title: 'Capture Free Pieces',
    subtitle: 'Spot undefended pieces and take them for free.' },
  { id: 'defend-your-pieces', topic: 'fundamentals', level: 2, estMinutes: 4,
    title: 'Defend Your Pieces',
    subtitle: 'A piece under attack: defend it, move it, or block.' },
  { id: 'mate-with-two-rooks', topic: 'fundamentals', level: 2, estMinutes: 5,
    title: 'Mate with Two Rooks',
    subtitle: 'The ladder mate — walk the king to the edge.' },
  { id: 'mate-with-the-queen', topic: 'fundamentals', level: 2, estMinutes: 6,
    title: 'Mate with the Queen',
    subtitle: 'Box in the king, bring your own, deliver mate.' },
  { id: 'stalemate-and-draw-traps', topic: 'fundamentals', level: 2, estMinutes: 5,
    title: 'Stalemate & Draw Traps',
    subtitle: "Don't let a won game slip into a draw." },

  // ——— Openings (Level 3) ———
  { id: 'control-the-center', topic: 'openings', level: 3, estMinutes: 5,
    title: 'Control the Center',
    subtitle: 'Why e4, d4, e5 and d5 decide the opening.' },
  { id: 'develop-your-pieces', topic: 'openings', level: 3, estMinutes: 6,
    title: 'Develop Your Pieces',
    subtitle: 'Get knights and bishops out fast, toward the center.' },
  { id: 'castle-to-safety', topic: 'openings', level: 3, estMinutes: 5,
    title: 'Castle to Safety',
    subtitle: 'Tuck the king away before the fight begins.' },
  { id: 'punish-early-queen-attacks', topic: 'openings', level: 3, estMinutes: 6,
    title: 'Punish Early Queen Attacks',
    subtitle: 'Defend against Scholar’s Mate and gain time doing it.' },

  // ——— Tactics (Levels 3–4) ———
  { id: 'forks', topic: 'tactics', level: 3, estMinutes: 6,
    title: 'Forks',
    subtitle: 'One move, two targets — the knight’s favorite trick.' },
  { id: 'pins', topic: 'tactics', level: 3, estMinutes: 6,
    title: 'Pins',
    subtitle: 'Freeze a piece against something more valuable behind it.' },
  { id: 'skewers', topic: 'tactics', level: 4, estMinutes: 5,
    title: 'Skewers',
    subtitle: 'A pin in reverse: the big piece must step aside.' },
  { id: 'discovered-attacks', topic: 'tactics', level: 4, estMinutes: 6,
    title: 'Discovered Attacks',
    subtitle: 'Move one piece, unleash another.' },
  { id: 'remove-the-defender', topic: 'tactics', level: 4, estMinutes: 6,
    title: 'Remove the Defender',
    subtitle: 'Capture or chase away the guard, then take the prize.' },
  { id: 'back-rank-mates', topic: 'tactics', level: 4, estMinutes: 6,
    title: 'Back-Rank Mates',
    subtitle: 'A trapped king behind its own pawns is a target.' },

  // ——— Strategy (Levels 4–5) ———
  { id: 'open-files-and-rooks', topic: 'strategy', level: 4, estMinutes: 6,
    title: 'Open Files & Rooks',
    subtitle: 'Rooks belong on open files — and then on the 7th rank.' },
  { id: 'passed-pawns', topic: 'strategy', level: 4, estMinutes: 6,
    title: 'Passed Pawns',
    subtitle: 'A pawn no enemy pawn can stop must be pushed.' },
  { id: 'knight-outposts', topic: 'strategy', level: 5, estMinutes: 6,
    title: 'Knight Outposts',
    subtitle: 'Park a knight where no pawn can ever kick it.' },
  { id: 'weak-squares-and-holes', topic: 'strategy', level: 5, estMinutes: 6,
    title: 'Weak Squares & Holes',
    subtitle: 'See the holes in a pawn structure — and occupy them.' },

  // ——— Endgames (Levels 4–6) ———
  { id: 'king-and-pawn-endgames', topic: 'endgames', level: 4, estMinutes: 6,
    title: 'King & Pawn Endgames',
    subtitle: 'The square of the pawn, and escorting it home.' },
  { id: 'the-opposition', topic: 'endgames', level: 5, estMinutes: 6,
    title: 'The Opposition',
    subtitle: 'The king duel that decides pawn endings.' },
  { id: 'queen-vs-pawn', topic: 'endgames', level: 5, estMinutes: 6,
    title: 'Queen vs. Pawn',
    subtitle: 'Stop a pawn one step from promotion.' },
  { id: 'rook-endgame-lucena', topic: 'endgames', level: 6, estMinutes: 7,
    title: 'The Lucena Position',
    subtitle: 'Build a bridge — the most famous winning technique.' },
  { id: 'rook-endgame-philidor', topic: 'endgames', level: 6, estMinutes: 7,
    title: 'The Philidor Defense',
    subtitle: 'The rook ending every defender must know.' },
];

export function getLessonMeta(id: string): LessonMeta | undefined {
  return LESSONS.find(l => l.id === id);
}

export function lessonsForTopic(topicId: string): LessonMeta[] {
  return LESSONS.filter(l => l.topic === topicId);
}
