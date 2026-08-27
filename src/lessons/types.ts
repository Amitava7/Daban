// Schema for the lessons knowledge base. See docs/LESSONS_PLAN.md.
// Lesson step data lives in src/lessons/data/**/*.json and is validated by
// scripts/validate-lessons.js against these shapes.

export type TopicId =
  | 'basics'
  | 'fundamentals'
  | 'openings'
  | 'tactics'
  | 'strategy'
  | 'endgames'
  | 'mating-patterns'
  | 'combinations'
  | 'opening-traps'
  | 'masterpieces';

export interface Arrow {
  from: string; // square, e.g. "g1"
  to: string;   // square, e.g. "f3"
}

/** A machine-checkable claim about the final user move of a solution line. */
export type LineAssert =
  | 'checkmate'
  | 'check'
  | 'capture'
  | 'promotion'
  | 'stalemate'
  | 'draw';

/** One ply with optional coach commentary. Even indices in a line are user
 *  moves, odd indices are automatic opponent replies. */
export interface AnnotatedMove {
  san: string;
  say?: string;
}

export interface SolutionLine {
  line: AnnotatedMove[];
  /** Enforced by the validator on the line's final user move. */
  assert?: LineAssert | null;
}

/** Declarative "any move achieving X is correct" — used where enumerating
 *  SANs is impractical (capture minigames, promotion, mate-in-1 with several
 *  mates, etc.). */
export type ChallengeGoal =
  | { type: 'checkmate' }
  | { type: 'check' }
  | { type: 'promote' }
  | { type: 'capture-on'; squares: string[] }
  | { type: 'reach'; squares: string[]; piece?: 'K' | 'Q' | 'R' | 'B' | 'N' | 'P' };

/** Keeps a challenge running across several user moves against a passive or
 *  moveless opponent — e.g. "capture all three pawns with your rook". */
export interface SequenceGoal {
  type: 'capture-all';
  /** How many enemy units must be captured to finish the step. */
  count: number;
  say?: string; // coach line repeated between captures
}

export interface IntroStep {
  kind: 'intro';
  fen: string;
  say: string;
  highlights?: string[];
  arrows?: Arrow[];
}

export interface ExplainStep {
  kind: 'explain';
  fen: string;
  say: string;
  /** Animated demonstration; alternates sides from the FEN's side to move. */
  autoMoves: AnnotatedMove[];
  highlights?: string[];
  arrows?: Arrow[];
}

export interface ChallengeStep {
  kind: 'challenge';
  fen: string;
  /** The question shown under the board, chess.com style. */
  prompt: string;
  /** Progressive text hints; last hint accompanies hintArrows. Min 1. */
  hints: string[];
  /** Arrows revealed on the final hint (or after 2 mistakes). If omitted the
   *  engine derives an arrow from the main line's next user move. */
  hintArrows?: Arrow[];
  /** Pre-lit squares for easy/early challenges. */
  highlights?: string[];
  /** Accepted solution branches. May be empty only when `goal` is present. */
  solutions?: SolutionLine[];
  /** Any legal move satisfying the goal is accepted (solutions, when also
   *  present, provide richer feedback for preferred moves). */
  goal?: ChallengeGoal;
  sequenceGoal?: SequenceGoal;
  /** Anticipated wrong moves with tailored coaching. */
  rejections?: { san: string; say: string }[];
  /** Fallback feedback for unanticipated wrong moves. */
  wrongSay?: string;
  /** Shown when the whole step is completed. */
  successSay?: string;
}

export type LessonStep = IntroStep | ExplainStep | ChallengeStep;

export interface Lesson {
  id: string;
  title: string;
  topic: TopicId;
  /** 1..6, chess.com-style difficulty band. */
  level: number;
  subtitle: string;
  /** Bullet goals shown on the lesson intro card. */
  goals: string[];
  estMinutes: number;
  steps: LessonStep[];
}

/** Lightweight metadata mirrored in config.ts so menus don't load steps. */
export interface LessonMeta {
  id: string;
  title: string;
  topic: TopicId;
  level: number;
  subtitle: string;
  estMinutes: number;
}

export interface Topic {
  id: TopicId;
  title: string;
  /** Emoji used as the tile icon until real art exists. */
  icon: string;
  description: string;
  /** 1-based display order in the lessons menu. */
  order: number;
}
