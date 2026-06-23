import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Storage, Progress, GameRecord, Settings, OpeningMastery, EndgameCompleted,
  calculateEloChange, computeAccuracy,
} from '../services/StorageService';

interface ProgressState {
  progress: Progress;
  settings: Settings;
  openingMastery: OpeningMastery;
  endgameCompleted: EndgameCompleted;
  isLoaded: boolean;
}

interface ProgressActions {
  recordGame: (record: Omit<GameRecord, 'eloChange' | 'date'>) => Promise<void>;
  updateSettings: (partial: Partial<Settings>) => Promise<void>;
  recordOpeningMove: (openingId: string, correct: boolean) => Promise<void>;
  completeEndgame: (puzzleId: string) => Promise<void>;
  weeklyEloChange: () => number;
  weeklyAccuracy: () => number;
  totalGames: () => number;
  avgBlundersPerGame: () => number;
}

type ProgressCtx = ProgressState & ProgressActions;

const Ctx = createContext<ProgressCtx | null>(null);

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<Progress>({ elo: 1000, games: [] });
  const [settings, setSettings] = useState<Settings>({
    level: 4, mode: 'light', personality: 'Balanced', timeControl: '10min',
  });
  const [openingMastery, setOpeningMastery] = useState<OpeningMastery>({});
  const [endgameCompleted, setEndgameCompleted] = useState<EndgameCompleted>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      Storage.getProgress(),
      Storage.getSettings(),
      Storage.getOpeningMastery(),
      Storage.getEndgameProgress(),
    ]).then(([prog, sett, opening, endgame]) => {
      setProgress(prog);
      setSettings(sett);
      setOpeningMastery(opening);
      setEndgameCompleted(endgame);
      setIsLoaded(true);
    });
  }, []);

  const recordGame = useCallback(async (record: Omit<GameRecord, 'eloChange' | 'date'>) => {
    const S = Storage;
    const engineElo = [600, 700, 850, 1000, 1100, 1250, 1400, 1550, 1700, 1900][record.level - 1];
    const eloChange = calculateEloChange(progress.elo, engineElo, record.result);
    const newRecord: GameRecord = {
      ...record,
      eloChange,
      date: new Date().toISOString(),
    };
    const newProgress: Progress = {
      elo: Math.max(100, progress.elo + eloChange),
      games: [newRecord, ...progress.games].slice(0, 200), // keep last 200 games
    };
    setProgress(newProgress);
    await S.saveProgress(newProgress);
  }, [progress]);

  const updateSettings = useCallback(async (partial: Partial<Settings>) => {
    const newSettings = { ...settings, ...partial };
    setSettings(newSettings);
    await Storage.saveSettings(newSettings);
  }, [settings]);

  const recordOpeningMove = useCallback(async (openingId: string, correct: boolean) => {
    const current = openingMastery[openingId] ?? { played: 0, correct: 0 };
    const updated: OpeningMastery = {
      ...openingMastery,
      [openingId]: {
        played: current.played + 1,
        correct: current.correct + (correct ? 1 : 0),
      },
    };
    setOpeningMastery(updated);
    await Storage.saveOpeningMastery(updated);
  }, [openingMastery]);

  const completeEndgame = useCallback(async (puzzleId: string) => {
    const updated = { ...endgameCompleted, [puzzleId]: true };
    setEndgameCompleted(updated);
    await Storage.saveEndgameProgress(updated);
  }, [endgameCompleted]);

  const weeklyEloChange = useCallback(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return progress.games
      .filter(g => new Date(g.date).getTime() > weekAgo)
      .reduce((sum, g) => sum + g.eloChange, 0);
  }, [progress]);

  const weeklyAccuracy = useCallback(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = progress.games.filter(g => new Date(g.date).getTime() > weekAgo);
    if (recent.length === 0) return 0;
    return Math.round(recent.reduce((s, g) => s + g.accuracy, 0) / recent.length);
  }, [progress]);

  const totalGames = useCallback(() => progress.games.length, [progress]);

  const avgBlundersPerGame = useCallback(() => {
    if (progress.games.length === 0) return 0;
    const recent = progress.games.slice(0, 20);
    const avg = recent.reduce((s, g) => s + g.blunders, 0) / recent.length;
    return Math.round(avg * 10) / 10;
  }, [progress]);

  return (
    <Ctx.Provider value={{
      progress, settings, openingMastery, endgameCompleted, isLoaded,
      recordGame, updateSettings, recordOpeningMove, completeEndgame,
      weeklyEloChange, weeklyAccuracy, totalGames, avgBlundersPerGame,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useProgress() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useProgress outside ProgressProvider');
  return ctx;
}
