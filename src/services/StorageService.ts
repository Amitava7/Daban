import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  SETTINGS: 'daban_settings',
  PROGRESS: 'daban_progress',
  SAVED_GAME: 'daban_saved_game',
  OPENING_MASTERY: 'daban_opening_mastery',
  ENDGAME_PROGRESS: 'daban_endgame_progress',
};

export interface Settings {
  level: number;           // 1–10
  mode: 'light' | 'dark';
  personality: string;     // Quiet | Balanced | Loud | Tournament
  timeControl: 'none' | '10min' | '5min';
}

export interface GameRecord {
  date: string;
  result: 'win' | 'loss' | 'draw';
  playerColor: 'w' | 'b';
  level: number;
  accuracy: number;
  blunders: number;
  moves: number;
  eloChange: number;
  opening?: string;
}

export interface Progress {
  elo: number;
  games: GameRecord[];
}

export interface SavedGame {
  fen: string;
  pgn: string;
  playerColor: 'w' | 'b';
  level: number;
  evalHistory: number[];
  timestamp: number;
}

export type OpeningMastery = Record<string, { played: number; correct: number }>;
export type EndgameCompleted = Record<string, boolean>;

const DEFAULT_SETTINGS: Settings = {
  level: 4,
  mode: 'light',
  personality: 'Balanced',
  timeControl: '10min',
};

const DEFAULT_PROGRESS: Progress = {
  elo: 1000,
  games: [],
};

async function get<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function set(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export const Storage = {
  getSettings: () => get<Settings>(KEYS.SETTINGS, DEFAULT_SETTINGS),
  saveSettings: (s: Settings) => set(KEYS.SETTINGS, s),

  getProgress: () => get<Progress>(KEYS.PROGRESS, DEFAULT_PROGRESS),
  saveProgress: (p: Progress) => set(KEYS.PROGRESS, p),

  getSavedGame: () => get<SavedGame | null>(KEYS.SAVED_GAME, null),
  saveGame: (g: SavedGame) => set(KEYS.SAVED_GAME, g),
  clearSavedGame: () => AsyncStorage.removeItem(KEYS.SAVED_GAME),

  getOpeningMastery: () => get<OpeningMastery>(KEYS.OPENING_MASTERY, {}),
  saveOpeningMastery: (m: OpeningMastery) => set(KEYS.OPENING_MASTERY, m),

  getEndgameProgress: () => get<EndgameCompleted>(KEYS.ENDGAME_PROGRESS, {}),
  saveEndgameProgress: (p: EndgameCompleted) => set(KEYS.ENDGAME_PROGRESS, p),
};

// Standard Elo calculation
export function calculateEloChange(
  playerElo: number,
  engineElo: number,
  result: 'win' | 'loss' | 'draw',
  k = 32,
): number {
  const expected = 1 / (1 + Math.pow(10, (engineElo - playerElo) / 400));
  const score = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;
  return Math.round(k * (score - expected));
}

export function computeAccuracy(centipawnLosses: number[]): number {
  if (centipawnLosses.length === 0) return 100;
  const avg = centipawnLosses.reduce((a, b) => a + b, 0) / centipawnLosses.length;
  // Convert avg centipawn loss to accuracy (0–100)
  // avg=0 → 100%, avg=300 → ~50%, avg=600 → ~0%
  return Math.max(0, Math.round(100 - avg / 6));
}
