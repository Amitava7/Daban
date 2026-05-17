export interface OpeningMove {
  san: string;
  explanation: string;
  children: OpeningMove[];
}

export interface Opening {
  id: string;
  name: string;
  shortName: string;
  side: 'w' | 'b'; // which side the user plays
  description: string;
  moves: OpeningMove[];
}

export const OPENINGS: Opening[] = [
  {
    id: 'italian',
    name: 'Italian Game',
    shortName: 'Italian',
    side: 'w',
    description: 'Control the center with e4 and develop naturally.',
    moves: [
      { san: 'e4', explanation: 'Control the center and open lines for your pieces.', children: [
        { san: 'e5', explanation: 'Black mirrors your center control.', children: [
          { san: 'Nf3', explanation: 'Attack the e5 pawn and develop a piece.', children: [
            { san: 'Nc6', explanation: 'Black defends e5 with a knight.', children: [
              { san: 'Bc4', explanation: 'The Italian — targets f7, the weakest square near the black king.', children: [
                { san: 'Bc5', explanation: 'The Giuoco Piano — Black mirrors your bishop.', children: [
                  { san: 'c3', explanation: 'Prepare d4 to challenge the center.', children: [
                    { san: 'Nf6', explanation: 'Black develops and counter-attacks e4.', children: [
                      { san: 'd4', explanation: 'Strike in the center! This is the critical pawn break.', children: [] },
                    ]},
                  ]},
                ]},
                { san: 'Nf6', explanation: 'Two Knights Defense — more aggressive.', children: [
                  { san: 'Ng5', explanation: 'Attack f7 directly!', children: [] },
                ]},
              ]},
            ]},
          ]},
        ]},
      ]},
    ],
  },
  {
    id: 'ruy_lopez',
    name: 'Ruy Lopez',
    shortName: 'Ruy Lopez',
    side: 'w',
    description: 'The oldest and most classic of openings. Pin the knight defending e5.',
    moves: [
      { san: 'e4', explanation: 'Open the center.', children: [
        { san: 'e5', explanation: 'Black controls center.', children: [
          { san: 'Nf3', explanation: 'Develop and attack e5.', children: [
            { san: 'Nc6', explanation: 'Black defends.', children: [
              { san: 'Bb5', explanation: 'The Ruy Lopez! Pin the knight — indirectly pressuring e5.', children: [
                { san: 'a6', explanation: 'Morphy Defense — challenge the bishop.', children: [
                  { san: 'Ba4', explanation: 'Retreat but keep the pin going.', children: [
                    { san: 'Nf6', explanation: 'Black develops and threatens e4.', children: [
                      { san: 'O-O', explanation: 'Castle! King safety first.', children: [
                        { san: 'Be7', explanation: 'Black prepares to castle.', children: [
                          { san: 'Re1', explanation: 'Reinforce the e-pawn, anticipate e5.', children: [] },
                        ]},
                      ]},
                    ]},
                  ]},
                ]},
              ]},
            ]},
          ]},
        ]},
      ]},
    ],
  },
  {
    id: 'london',
    name: 'London System',
    shortName: 'London',
    side: 'w',
    description: 'A solid, system-based opening. Reliable against anything Black plays.',
    moves: [
      { san: 'd4', explanation: 'Control the center with a queen pawn.', children: [
        { san: 'd5', explanation: 'Black claims equal center space.', children: [
          { san: 'Nf3', explanation: 'Develop a knight naturally.', children: [
            { san: 'Nf6', explanation: 'Black mirrors.', children: [
              { san: 'Bf4', explanation: 'The London bishop — develops outside the pawn chain.', children: [
                { san: 'e6', explanation: 'Black plays solidly.', children: [
                  { san: 'e3', explanation: 'Reinforce the center and prepare Be2.', children: [
                    { san: 'Bd6', explanation: 'Black challenges your bishop.', children: [
                      { san: 'Bg3', explanation: 'Trade would help Black — retreat instead.', children: [
                        { san: 'O-O', explanation: 'Black castles kingside.', children: [
                          { san: 'Nbd2', explanation: 'Develop the last minor piece.', children: [] },
                        ]},
                      ]},
                    ]},
                  ]},
                ]},
              ]},
            ]},
          ]},
        ]},
      ]},
    ],
  },
  {
    id: 'sicilian',
    name: 'Sicilian Najdorf',
    shortName: 'Sicilian',
    side: 'b',
    description: 'Black\'s most aggressive response to e4. Fight for the center asymmetrically.',
    moves: [
      { san: 'e4', explanation: 'White takes the center.', children: [
        { san: 'c5', explanation: 'Sicilian! Control d4 from the flank without giving White a free pawn center.', children: [
          { san: 'Nf3', explanation: 'White develops.', children: [
            { san: 'd6', explanation: 'Prepare e5 or Nf6.', children: [
              { san: 'd4', explanation: 'White opens the center.', children: [
                { san: 'cxd4', explanation: 'Capture! Destroy White\'s center pawn.', children: [
                  { san: 'Nxd4', explanation: 'White recaptures with the knight.', children: [
                    { san: 'Nf6', explanation: 'Develop and pressure e4.', children: [
                      { san: 'Nc3', explanation: 'White defends e4.', children: [
                        { san: 'a6', explanation: 'The Najdorf! Prevent Bb5 and prepare b5 expansion.', children: [] },
                      ]},
                    ]},
                  ]},
                ]},
              ]},
            ]},
          ]},
        ]},
      ]},
    ],
  },
  {
    id: 'caro_kann',
    name: 'Caro-Kann',
    shortName: 'Caro-Kann',
    side: 'b',
    description: 'A solid defense. Support d5 with c6 — more principled than the French.',
    moves: [
      { san: 'e4', explanation: 'White takes the center.', children: [
        { san: 'c6', explanation: 'Caro-Kann! Prepare d5 with solid support.', children: [
          { san: 'd4', explanation: 'White reinforces the center.', children: [
            { san: 'd5', explanation: 'Strike the center immediately!', children: [
              { san: 'e5', explanation: 'Advance Variation — White pushes forward.', children: [
                { san: 'Bf5', explanation: 'Develop the bishop before playing e6 (unlike the French).', children: [
                  { san: 'Nf3', explanation: 'White develops.', children: [
                    { san: 'e6', explanation: 'Support the center and prepare Nd7.', children: [
                      { san: 'Be2', explanation: 'White prepares O-O.', children: [
                        { san: 'Nd7', explanation: 'Complete development — now plan to challenge the center.', children: [] },
                      ]},
                    ]},
                  ]},
                ]},
              ]},
              { san: 'Nc3', explanation: 'Classical Variation.', children: [
                { san: 'dxe4', explanation: 'Exchange in the center.', children: [
                  { san: 'Nxe4', explanation: 'White recaptures.', children: [
                    { san: 'Bf5', explanation: 'Develop the bishop actively.', children: [] },
                  ]},
                ]},
              ]},
            ]},
          ]},
        ]},
      ]},
    ],
  },
];

export function getOpeningById(id: string): Opening | undefined {
  return OPENINGS.find(o => o.id === id);
}

// Follow a move sequence through the opening tree and return the next expected moves
export function getNextMoves(opening: Opening, played: string[]): OpeningMove[] {
  let nodes = opening.moves;
  for (const san of played) {
    const found = nodes.find(n => n.san === san);
    if (!found) return [];
    nodes = found.children;
  }
  return nodes;
}

// Check if a played SAN matches the expected move (returns the matched move or null)
export function matchOpeningMove(
  opening: Opening,
  played: string[],
  san: string,
): OpeningMove | null {
  const next = getNextMoves(opening, played);
  return next.find(n => n.san === san) ?? null;
}

// Get the explanation for the latest correct move
export function getMoveExplanation(opening: Opening, played: string[]): string {
  if (played.length === 0) return '';
  const prev = played.slice(0, -1);
  const last = played[played.length - 1];
  const nodes = getNextMoves(opening, prev);
  return nodes.find(n => n.san === last)?.explanation ?? '';
}

// Is the drill complete (no more moves in tree)?
export function isDrillComplete(opening: Opening, played: string[]): boolean {
  return getNextMoves(opening, played).length === 0;
}
