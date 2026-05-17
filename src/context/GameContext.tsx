import React, {
  createContext, useContext, useState, useCallback, useRef, useEffect,
} from 'react';
import { Chess } from 'chess.js';
import { getBestMove, getEvaluation, levelToDepth, levelToElo } from '../engine/ChessEngine';
import { classifyMove, MoveAnalysis } from '../engine/MoveClassifier';
import { Storage, computeAccuracy } from '../services/StorageService';

export interface MoveRecord {
  san: string;
  fen: string;         // position after this move
  eval: number;        // centipawns, white-positive
  analysis?: MoveAnalysis;
  playerMove: boolean;
}

export type GameStatus =
  | 'idle'
  | 'playing'
  | 'engine_thinking'
  | 'player_blundered'
  | 'game_over';

export type GameResult = 'win' | 'loss' | 'draw' | null;

export interface GameState {
  chess: Chess;
  fen: string;
  playerColor: 'w' | 'b';
  level: number;
  status: GameStatus;
  result: GameResult;
  moveHistory: MoveRecord[];
  lastAnalysis: MoveAnalysis | null;
  currentEval: number;        // centipawns, white-positive
  selectedSquare: string | null;
  legalMoves: string[];       // destination squares for selectedSquare
  timeWhite: number | null;   // seconds remaining (null = no clock)
  timeBlack: number | null;
  hintsUsed: number;
  pendingRefutation: string[] | null; // refutation line to show
}

interface GameActions {
  startNewGame: (playerColor: 'w' | 'b', level: number, timeControl: 'none' | '10min' | '5min') => void;
  selectSquare: (sq: string) => void;
  makeMove: (from: string, to: string, promotion?: string) => Promise<void>;
  resign: () => void;
  offerDraw: () => void;
  useHint: () => void;
  clearBlunderAlert: () => void;
  loadSavedGame: () => Promise<boolean>;
  saveCurrentGame: () => Promise<void>;
}

const GameCtx = createContext<(GameState & GameActions) | null>(null);

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const MAX_HINTS = 3;

function getLegalDestinations(chess: Chess, sq: string): string[] {
  return chess.moves({ square: sq as any, verbose: true }).map((m: any) => m.to);
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(INITIAL_FEN);
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>('w');
  const [level, setLevel] = useState(4);
  const [status, setStatus] = useState<GameStatus>('idle');
  const [result, setResult] = useState<GameResult>(null);
  const [moveHistory, setMoveHistory] = useState<MoveRecord[]>([]);
  const [lastAnalysis, setLastAnalysis] = useState<MoveAnalysis | null>(null);
  const [currentEval, setCurrentEval] = useState(0);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [timeWhite, setTimeWhite] = useState<number | null>(null);
  const [timeBlack, setTimeBlack] = useState<number | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [pendingRefutation, setPendingRefutation] = useState<string[] | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const startTimer = useCallback((playerTurn: 'w' | 'b') => {
    clearTimer();
    if (timeWhite === null) return;
    timerRef.current = setInterval(() => {
      if (playerTurn === 'w') {
        setTimeWhite(t => {
          if (t === null || t <= 0) return 0;
          return t - 1;
        });
      } else {
        setTimeBlack(t => {
          if (t === null || t <= 0) return 0;
          return t - 1;
        });
      }
    }, 1000);
  }, [timeWhite]);

  useEffect(() => { return () => clearTimer(); }, []);

  const endGame = useCallback((res: GameResult, chessInstance: Chess, history: MoveRecord[]) => {
    clearTimer();
    setResult(res);
    setStatus('game_over');
    setSelectedSquare(null);
    setLegalMoves([]);
    // Save result for progress tracking via event
    const losses = history
      .filter(m => m.playerMove && m.analysis)
      .map(m => m.analysis!.centipawnLoss);
    const blunders = history.filter(m => m.playerMove && m.analysis?.quality === 'blunder').length;
    Storage.saveGame({
      fen: chessInstance.fen(),
      pgn: chessInstance.pgn(),
      playerColor,
      level,
      evalHistory: history.map(m => m.eval),
      timestamp: Date.now(),
    });
  }, [playerColor, level]);

  const startNewGame = useCallback((
    color: 'w' | 'b',
    lvl: number,
    timeControl: 'none' | '10min' | '5min',
  ) => {
    clearTimer();
    chess.reset();
    const initialEval = getEvaluation(chess, 1);
    const seconds = timeControl === '10min' ? 600 : timeControl === '5min' ? 300 : null;

    setFen(chess.fen());
    setPlayerColor(color);
    setLevel(lvl);
    setStatus('playing');
    setResult(null);
    setMoveHistory([]);
    setLastAnalysis(null);
    setCurrentEval(initialEval);
    setSelectedSquare(null);
    setLegalMoves([]);
    setTimeWhite(seconds);
    setTimeBlack(seconds);
    setHintsUsed(0);
    setPendingRefutation(null);

    // If player is black, engine makes first move
    if (color === 'b') {
      setStatus('engine_thinking');
      setTimeout(() => {
        const depth = levelToDepth(lvl);
        const result = getBestMove(chess, depth);
        chess.move({ from: result.from, to: result.to, promotion: result.promotion });
        const newFen = chess.fen();
        const evalNow = getEvaluation(chess, 1);
        const record: MoveRecord = {
          san: result.san,
          fen: newFen,
          eval: evalNow,
          playerMove: false,
        };
        setFen(newFen);
        setCurrentEval(evalNow);
        setMoveHistory([record]);
        setStatus('playing');
      }, 300);
    }
  }, [chess]);

  const selectSquare = useCallback((sq: string) => {
    if (status !== 'playing') return;
    if (chess.turn() !== playerColor) return;

    const piece = chess.get(sq as any);

    // If clicking a legal move destination
    if (selectedSquare && legalMoves.includes(sq)) {
      // Will be handled by makeMove
      return;
    }

    // Select own piece
    if (piece && piece.color === playerColor) {
      const destinations = getLegalDestinations(chess, sq);
      setSelectedSquare(sq);
      setLegalMoves(destinations);
    } else {
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  }, [status, chess, playerColor, selectedSquare, legalMoves]);

  const makeMove = useCallback(async (from: string, to: string, promotion?: string) => {
    if (status !== 'playing') return;
    if (chess.turn() !== playerColor) return;

    const chessBefore = new Chess(chess.fen());

    // Make the move
    let moveResult: any;
    try {
      moveResult = chess.move({ from, to, promotion: promotion ?? 'q' });
    } catch {
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    setSelectedSquare(null);
    setLegalMoves([]);

    const newFen = chess.fen();
    setFen(newFen);

    // Classify the move
    const analysis = classifyMove(chessBefore, moveResult.san, 2);
    setLastAnalysis(analysis);
    setCurrentEval(analysis.evalAfter);

    const record: MoveRecord = {
      san: moveResult.san,
      fen: newFen,
      eval: analysis.evalAfter,
      analysis,
      playerMove: true,
    };

    setMoveHistory(prev => {
      const updated = [...prev, record];

      // Check game over
      if (chess.isGameOver()) {
        let res: GameResult = 'draw';
        if (chess.isCheckmate()) res = playerColor === chess.turn() ? 'loss' : 'win';
        endGame(res, chess, updated);
        return updated;
      }

      // Show blunder alert if needed
      if (analysis.quality === 'blunder' || analysis.quality === 'mistake') {
        setStatus('player_blundered');
      } else {
        // Engine's turn
        setStatus('engine_thinking');
        setTimeout(() => {
          const depth = levelToDepth(level);
          const engineResult = getBestMove(chess, depth);
          chess.move({ from: engineResult.from, to: engineResult.to, promotion: engineResult.promotion });
          const engineFen = chess.fen();
          const evalNow = getEvaluation(chess, 1);
          const engineRecord: MoveRecord = {
            san: engineResult.san,
            fen: engineFen,
            eval: evalNow,
            playerMove: false,
          };
          setFen(engineFen);
          setCurrentEval(evalNow);
          setMoveHistory(prev2 => {
            const withEngine = [...prev2, engineRecord];
            if (chess.isGameOver()) {
              let res: GameResult = 'draw';
              if (chess.isCheckmate()) res = playerColor === chess.turn() ? 'loss' : 'win';
              endGame(res, chess, withEngine);
            } else {
              setStatus('playing');
            }
            return withEngine;
          });
        }, 300 + Math.random() * 400);
      }

      return updated;
    });
  }, [status, chess, playerColor, level, endGame]);

  const clearBlunderAlert = useCallback(() => {
    if (status !== 'player_blundered') return;
    // Engine responds after player acknowledges
    setStatus('engine_thinking');
    setTimeout(() => {
      const depth = levelToDepth(level);
      const engineResult = getBestMove(chess, depth);
      chess.move({ from: engineResult.from, to: engineResult.to, promotion: engineResult.promotion });
      const engineFen = chess.fen();
      const evalNow = getEvaluation(chess, 1);
      const engineRecord: MoveRecord = {
        san: engineResult.san,
        fen: engineFen,
        eval: evalNow,
        playerMove: false,
      };
      setFen(engineFen);
      setCurrentEval(evalNow);
      setMoveHistory(prev => {
        const updated = [...prev, engineRecord];
        if (chess.isGameOver()) {
          let res: GameResult = 'draw';
          if (chess.isCheckmate()) res = playerColor === chess.turn() ? 'loss' : 'win';
          endGame(res, chess, updated);
        } else {
          setStatus('playing');
        }
        return updated;
      });
    }, 500);
  }, [status, chess, level, playerColor, endGame]);

  const resign = useCallback(() => {
    clearTimer();
    setStatus('game_over');
    setResult('loss');
  }, []);

  const offerDraw = useCallback(() => {
    clearTimer();
    setStatus('game_over');
    setResult('draw');
  }, []);

  const useHint = useCallback(() => {
    setHintsUsed(h => Math.min(h + 1, MAX_HINTS));
  }, []);

  const loadSavedGame = useCallback(async () => {
    const saved = await Storage.getSavedGame();
    if (!saved) return false;
    chess.load(saved.fen);
    setFen(saved.fen);
    setPlayerColor(saved.playerColor);
    setLevel(saved.level);
    setStatus('playing');
    setResult(null);
    setMoveHistory([]);
    setLastAnalysis(null);
    setCurrentEval(getEvaluation(chess, 1));
    setSelectedSquare(null);
    setLegalMoves([]);
    setHintsUsed(0);
    setPendingRefutation(null);
    return true;
  }, [chess]);

  const saveCurrentGame = useCallback(async () => {
    if (status === 'idle') return;
    await Storage.saveGame({
      fen: chess.fen(),
      pgn: chess.pgn(),
      playerColor,
      level,
      evalHistory: moveHistory.map(m => m.eval),
      timestamp: Date.now(),
    });
  }, [chess, playerColor, level, moveHistory, status]);

  return (
    <GameCtx.Provider value={{
      chess, fen, playerColor, level, status, result, moveHistory,
      lastAnalysis, currentEval, selectedSquare, legalMoves,
      timeWhite, timeBlack, hintsUsed, pendingRefutation,
      startNewGame, selectSquare, makeMove, resign, offerDraw,
      useHint, clearBlunderAlert, loadSavedGame, saveCurrentGame,
    }}>
      {children}
    </GameCtx.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameCtx);
  if (!ctx) throw new Error('useGame outside GameProvider');
  return ctx;
}
