export type RootStackParamList = {
  Home: undefined;
  /** Choose colour/clock before a game. `fen` starts the game from that
   *  position instead of the initial array; `fromLabel` names where it came
   *  from (e.g. a lesson title) for the header. */
  ColorPicker: { fen?: string; fromLabel?: string } | undefined;
  Game: undefined;
  Hint: undefined;
  Feedback: undefined;
  Refutation: undefined;
  Review: undefined;
  Openings: undefined;
  OpeningDrill: { openingId: string };
  Lessons: undefined;
  LessonTopic: { topicId: string };
  LessonPlayer: { lessonId: string };
  Endgames: undefined;
  EndgamePuzzle: { puzzleId: string };
  Progress: undefined;
  Settings: undefined;
};
