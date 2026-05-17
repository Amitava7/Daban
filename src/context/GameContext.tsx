import React, {
  createContext, useContext, useState, useCallback, useRef, useEffect,
} from 'react';
import { InteractionManager } from 'react-native';
import { Chess } from 'chess.js';
import { getBestMove, getEvaluation, levelToDepth, levelToElo } from '../engine/ChessEngine';
import { classifyMove, MoveAnalysis } from '../engine/MoveClassifier';
import { Storage, computeAccuracy } from '../services/StorageService';
import type { PieceData } from '../components/Board';

export interface MoveRecord {
  san: string;
  fen: string;
  eval: number;
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

export interface CaptureFlashState {
  id: number;
  sq: string;
  points: number;
  gained: boolean;
}

export interface GameState {
  chess: Chess;
  fen: string;
  playerColor: 'w' | 'b';
  level: number;
  status: GameStatus;
  result: GameResult;
  moveHistory: MoveRecord[];
  lastAnalysis: MoveAnalysis | null;
  currentEval: number;
  selectedSquare: string | null;
  legalMoves: string[];
  timeWhite: number | null;
  timeBlack: number | null;
  hintsUsed: number;
  pendingRefutation: string[] | null;
  boardPieces: PieceData[];           // stable-id piece list for animated board
  lastMove: { from: string; to: string } | null;
  captureFlash: CaptureFlashState | null;
}

interface GameActions {
  startNewGame: (playerColor: 'w' | 'b', level: number, timeControl: 'none' | '10min' | '5min') => void;
  selectSquare: (sq: string) => void;
  makeMove: (from: string, to: string, promotion?: string) => Promise<void>;
  resign: () => void;
  offerDraw: () => void;
  useHint: () => void;
  clearBlunderAlert: () => void;
  clearCaptureFlash: () => void;
  loadSavedGame: () => Promise<boolean>;
  saveCurrentGame: () => Promise<void>;
}

const GameCtx = createContext<(GameState & GameActions) | null>(null);

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const MAX_HINTS = 3;

const PIECE_POINTS: Record<string, number> = {
  P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0,
};

function buildInitialPieces(): PieceData[] {
  const list: PieceData[] = [];
  const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  let n = 0;
  for (let f = 0; f < 8; f++) {
    const file = 'abcdefgh'[f];
    list.push({ id: `bp${n++}`, sq: `${file}8`, code: 'b' + back[f] });
    list.push({ id: `bp${n++}`, sq: `${file}7`, code: 'bP' });
    list.push({ id: `bp${n++}`, sq: `${file}2`, code: 'wP' });
    list.push({ id: `bp${n++}`, sq: `${file}1`, code: 'w' + back[f] });
  }
  return list;
}

function piecesFromFen(fen: string): PieceData[] {
  const board = fen.split(' ')[0];
  const list: PieceData[] = [];
  let rank = 8;
  let file = 0;
  let idx = 0;
  for (const ch of board) {
    if (ch === '/') { rank--; file = 0; continue; }
    if (ch >= '1' && ch <= '8') { file += parseInt(ch, 10); continue; }
    const sq = `${'abcdefgh'[file]}${rank}`;
    const color = ch === ch.toUpperCase() ? 'w' : 'b';
    const type = ch.toUpperCase();
    list.push({ id: `p${idx++}`, sq, code: color + type });
    file++;
  }
  return list;
}

function applyMoveToPieces(prev: PieceData[], move: any): PieceData[] {
  const next = prev.map(p => ({ ...p }));
  const from = move.from as string;
  const to = move.to as string;
  const flags: string = move.flags ?? '';

  // Identify capture square (en passant differs)
  let captureSq: string | null = null;
  if (move.captured) {
    if (flags.includes('e')) {
      // en passant: captured pawn on `to`-file, `from`-rank
      captureSq = `${to[0]}${from[1]}`;
    } else {
      captureSq = to;
    }
  }

  if (captureSq) {
    const cap = next.find(p => !p.captured && p.sq === captureSq);
    if (cap) cap.captured = true;
  }

  const moving = next.find(p => !p.captured && p.sq === from);
  if (moving) {
    moving.sq = to;
    if (move.promotion) {
      moving.code = moving.code[0] + move.promotion.toUpperCase();
    }
  }

  // Castling: also move the rook
  if (flags.includes('k')) {
    const rank = from[1];
    const rook = next.find(p => !p.captured && p.sq === `h${rank}`);
    if (rook) rook.sq = `f${rank}`;
  } else if (flags.includes('q')) {
    const rank = from[1];
    const rook = next.find(p => !p.captured && p.sq === `a${rank}`);
    if (rook) rook.sq = `d${rank}`;
  }

  return next;
}

function getLegalDestinations(chess: Chess, sq: string): string[] {
  return chess.moves({ square: sq as any, verbose: true }).map((m: any) => m.to);
}

function captureFlashForMove(move: any, isPlayerMove: boolean): CaptureFlashState | null {
  if (!move.captured) return null;
  const points = PIECE_POINTS[move.captured.toUpperCase()] ?? 0;
  if (points === 0) return null;
  const flags: string = move.flags ?? '';
  let sq = move.to as string;
  if (flags.includes('e')) {
    sq = `${move.to[0]}${move.from[1]}`;
  }
  return {
    id: Date.now() + Math.random(),
    sq,
    points,
    gained: isPlayerMove,
  };
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
  const [boardPieces, setBoardPieces] = useState<PieceData[]>(buildInitialPieces);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [captureFlash, setCaptureFlash] = useState<CaptureFlashState | null>(null);

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
        setTimeWhite(t => (t === null || t <= 0 ? 0 : t - 1));
      } else {
        setTimeBlack(t => (t === null || t <= 0 ? 0 : t - 1));
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
    Storage.saveGame({
      fen: chessInstance.fen(),
      pgn: chessInstance.pgn(),
      playerColor,
      level,
      evalHistory: history.map(m => m.eval),
      timestamp: Date.now(),
    });
  }, [playerColor, level]);

  const clearCaptureFlash = useCallback(() => {
    setCaptureFlash(null);
  }, []);

  // Helper: run engine move asynchronously (off the render path).
  const runEngineMove = useCallback(() => {
    // Defer to next tick so the "Thinking..." UI updates first; then the
    // engine computes in a follow-up tick so the JS thread can interleave.
    setTimeout(() => {
      const depth = levelToDepth(level);
      const engineResult = getBestMove(chess, depth);
      const moveData = chess.move({
        from: engineResult.from,
        to: engineResult.to,
        promotion: engineResult.promotion,
      });
      const engineFen = chess.fen();
      const engineRecord: MoveRecord = {
        san: engineResult.san,
        fen: engineFen,
        eval: 0, // filled in below
        playerMove: false,
      };
      setFen(engineFen);
      setBoardPieces(prev => applyMoveToPieces(prev, moveData));
      setLastMove({ from: moveData.from, to: moveData.to });
      const flash = captureFlashForMove(moveData, /*isPlayerMove*/ false);
      if (flash) setCaptureFlash(flash);
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
      // Defer eval (shallow) one more tick so the piece animation has begun
      setTimeout(() => {
        const evalNow = getEvaluation(chess, 1);
        setCurrentEval(evalNow);
      }, 0);
    }, 0);
  }, [chess, level, playerColor, endGame]);

  const startNewGame = useCallback((
    color: 'w' | 'b',
    lvl: number,
    timeControl: 'none' | '10min' | '5min',
  ) => {
    clearTimer();
    chess.reset();
    const initialEval = 0;
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
    setBoardPieces(buildInitialPieces());
    setLastMove(null);
    setCaptureFlash(null);

    // Initial eval computation can wait
    InteractionManager.runAfterInteractions(() => {
      const eEval = getEvaluation(chess, 1);
      setCurrentEval(eEval);
    });

    if (color === 'b') {
      setStatus('engine_thinking');
      runEngineMove();
    }
  }, [chess, runEngineMove]);

  const selectSquare = useCallback((sq: string) => {
    if (status !== 'playing') return;
    if (chess.turn() !== playerColor) return;

    const piece = chess.get(sq as any);

    if (selectedSquare && legalMoves.includes(sq)) {
      // Will be handled by makeMove via GameScreen
      return;
    }

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

    let moveResult: any;
    try {
      moveResult = chess.move({ from, to, promotion: promotion ?? 'q' });
    } catch {
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    // === FAST PATH: update UI immediately ===
    setSelectedSquare(null);
    setLegalMoves([]);
    const newFen = chess.fen();
    setFen(newFen);
    setBoardPieces(prev => applyMoveToPieces(prev, moveResult));
    setLastMove({ from: moveResult.from, to: moveResult.to });
    const flash = captureFlashForMove(moveResult, /*isPlayerMove*/ true);
    if (flash) setCaptureFlash(flash);

    // === SLOW PATH: defer heavy analysis so the board renders first ===
    // setTimeout(0) yields to the event loop so React flushes the state
    // updates above before the synchronous classifyMove runs.
    setTimeout(() => {
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

        if (chess.isGameOver()) {
          let res: GameResult = 'draw';
          if (chess.isCheckmate()) res = playerColor === chess.turn() ? 'loss' : 'win';
          endGame(res, chess, updated);
          return updated;
        }

        if (analysis.quality === 'blunder' || analysis.quality === 'mistake') {
          setStatus('player_blundered');
        } else {
          setStatus('engine_thinking');
          // Small thinking delay for natural feel, then engine moves
          setTimeout(() => runEngineMove(), 280 + Math.random() * 220);
        }

        return updated;
      });
    }, 0);
  }, [status, chess, playerColor, endGame, runEngineMove]);

  const clearBlunderAlert = useCallback(() => {
    if (status !== 'player_blundered') return;
    setStatus('engine_thinking');
    setTimeout(() => runEngineMove(), 200);
  }, [status, runEngineMove]);

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
    setSelectedSquare(null);
    setLegalMoves([]);
    setHintsUsed(0);
    setPendingRefutation(null);
    setBoardPieces(piecesFromFen(saved.fen));
    setLastMove(null);
    setCaptureFlash(null);
    InteractionManager.runAfterInteractions(() => {
      setCurrentEval(getEvaluation(chess, 1));
    });
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
      boardPieces, lastMove, captureFlash,
      startNewGame, selectSquare, makeMove, resign, offerDraw,
      useHint, clearBlunderAlert, clearCaptureFlash, loadSavedGame, saveCurrentGame,
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
