export type RootStackParamList = {
  Home: undefined;
  ColorPicker: undefined;   // choose color before game
  Game: undefined;
  Hint: undefined;
  Feedback: undefined;
  Refutation: undefined;
  Review: undefined;
  Openings: undefined;
  OpeningDrill: { openingId: string };
  Endgames: undefined;
  EndgamePuzzle: { puzzleId: string };
  Progress: undefined;
  Settings: undefined;
};
