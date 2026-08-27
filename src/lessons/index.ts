// Static registry mapping lesson ids to their JSON step data. Metro requires
// static require() calls, so every lesson file is listed here explicitly.
// scripts/validate-lessons.js checks this map stays in sync with config.ts.

import { Lesson } from './types';

const REGISTRY: Record<string, () => Lesson> = {
  // Chess Basics
  'the-rook': () => require('./data/basics/the-rook.json'),
  'the-bishop': () => require('./data/basics/the-bishop.json'),
  'the-queen': () => require('./data/basics/the-queen.json'),
  'the-knight': () => require('./data/basics/the-knight.json'),
  'the-pawn': () => require('./data/basics/the-pawn.json'),
  'the-king-and-check': () => require('./data/basics/the-king-and-check.json'),
  'checkmate-basics': () => require('./data/basics/checkmate-basics.json'),
  'special-moves': () => require('./data/basics/special-moves.json'),
  // Winning the Game
  'capture-free-pieces': () => require('./data/fundamentals/capture-free-pieces.json'),
  'defend-your-pieces': () => require('./data/fundamentals/defend-your-pieces.json'),
  'mate-with-two-rooks': () => require('./data/fundamentals/mate-with-two-rooks.json'),
  'mate-with-the-queen': () => require('./data/fundamentals/mate-with-the-queen.json'),
  'stalemate-and-draw-traps': () => require('./data/fundamentals/stalemate-and-draw-traps.json'),
  // Openings
  'control-the-center': () => require('./data/openings/control-the-center.json'),
  'develop-your-pieces': () => require('./data/openings/develop-your-pieces.json'),
  'castle-to-safety': () => require('./data/openings/castle-to-safety.json'),
  'punish-early-queen-attacks': () => require('./data/openings/punish-early-queen-attacks.json'),
  // Tactics
  'forks': () => require('./data/tactics/forks.json'),
  'pins': () => require('./data/tactics/pins.json'),
  'skewers': () => require('./data/tactics/skewers.json'),
  'discovered-attacks': () => require('./data/tactics/discovered-attacks.json'),
  'remove-the-defender': () => require('./data/tactics/remove-the-defender.json'),
  'back-rank-mates': () => require('./data/tactics/back-rank-mates.json'),
  'trapped-pieces': () => require('./data/tactics/trapped-pieces.json'),
  'defensive-resources': () => require('./data/tactics/defensive-resources.json'),
  // Strategy
  'open-files-and-rooks': () => require('./data/strategy/open-files-and-rooks.json'),
  'passed-pawns': () => require('./data/strategy/passed-pawns.json'),
  'knight-outposts': () => require('./data/strategy/knight-outposts.json'),
  'weak-squares-and-holes': () => require('./data/strategy/weak-squares-and-holes.json'),
  // Endgames
  'king-and-pawn-endgames': () => require('./data/endgames/king-and-pawn-endgames.json'),
  'the-opposition': () => require('./data/endgames/the-opposition.json'),
  'queen-vs-pawn': () => require('./data/endgames/queen-vs-pawn.json'),
  'rook-endgame-lucena': () => require('./data/endgames/rook-endgame-lucena.json'),
  'rook-endgame-philidor': () => require('./data/endgames/rook-endgame-philidor.json'),
  'zugzwang': () => require('./data/endgames/zugzwang.json'),
  'pawn-breakthrough': () => require('./data/endgames/pawn-breakthrough.json'),
  'rook-vs-pawn': () => require('./data/endgames/rook-vs-pawn.json'),
  'bishop-vs-knight': () => require('./data/endgames/bishop-vs-knight.json'),
  'opposite-coloured-bishops': () => require('./data/endgames/opposite-coloured-bishops.json'),
  // Mating Patterns
  'spot-the-mate': () => require('./data/mating-patterns/spot-the-mate.json'),
  'arabian-and-damianos': () => require('./data/mating-patterns/arabian-and-damianos.json'),
  'bodens-mate': () => require('./data/mating-patterns/bodens-mate.json'),
  'anastasias-mate': () => require('./data/mating-patterns/anastasias-mate.json'),
  'philidors-legacy': () => require('./data/mating-patterns/philidors-legacy.json'),
  'greek-gift': () => require('./data/mating-patterns/greek-gift.json'),
  'more-mating-nets': () => require('./data/mating-patterns/more-mating-nets.json'),
  // Combinations
  'zwischenzug': () => require('./data/combinations/zwischenzug.json'),
  'clearance-sacrifice': () => require('./data/combinations/clearance-sacrifice.json'),
  'attraction': () => require('./data/combinations/attraction.json'),
  'desperado-and-mad-rook': () => require('./data/combinations/desperado-and-mad-rook.json'),
  'quiet-moves': () => require('./data/combinations/quiet-moves.json'),
  'counting-exchanges': () => require('./data/combinations/counting-exchanges.json'),
  // Opening Traps
  'lasker-trap': () => require('./data/opening-traps/lasker-trap.json'),
  'elephant-trap': () => require('./data/opening-traps/elephant-trap.json'),
  'gambit-traps': () => require('./data/opening-traps/gambit-traps.json'),
  'kieninger-and-noahs-ark': () => require('./data/opening-traps/kieninger-and-noahs-ark.json'),
  // Master Games
  'opera-game': () => require('./data/masterpieces/opera-game.json'),
  'torre-lasker-windmill': () => require('./data/masterpieces/torre-lasker-windmill.json'),
  'marshalls-gold-coins': () => require('./data/masterpieces/marshalls-gold-coins.json'),
  'game-of-the-century': () => require('./data/masterpieces/game-of-the-century.json'),
  'immortal-studies': () => require('./data/masterpieces/immortal-studies.json'),
};

export function getLessonById(id: string): Lesson | undefined {
  const load = REGISTRY[id];
  return load ? load() : undefined;
}

export const REGISTERED_LESSON_IDS = Object.keys(REGISTRY);
