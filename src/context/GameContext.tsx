import React, {
  createContext, useContext, useState, useCallback, useRef, useEffect,
} from 'react';
import { InteractionManager } from 'react-native';
import { Chess } from 'chess.js';
import {
  getBestMove, getEvaluation, levelToDepth, levelToElo,
  resetSearchNodes, getSearchNodes,
} from '../engine/ChessEngine';
import { classifyMove, MoveAnalysis } from '../engine/MoveClassifier';
import { Storage, computeAccuracy } from '../services/StorageService';
import { dlog } from '../utils/debugLog';
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
  playerTime: number | null;   // single clock — counts down on the player's turn
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
  undoLastMove: () => void;
  canUndo: () => boolean;
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
  const san: string = move.san ?? `${from}${to}`;

  // Snapshot what's at `from` and `to` BEFORE we touch anything, so any
  // mismatch between chess.js and our tracked pieces shows up in the log.
  const pieceAtFrom = prev.find(p => !p.captured && p.sq === from);
  const pieceAtTo = prev.find(p => !p.captured && p.sq === to);
  dlog(
    'applyMove',
    `IN  san=${san} from=${from} to=${to} flags=${flags} ` +
    `prev[from]=${pieceAtFrom ? `${pieceAtFrom.id}/${pieceAtFrom.code}` : 'NONE'} ` +
    `prev[to]=${pieceAtTo ? `${pieceAtTo.id}/${pieceAtTo.code}` : 'NONE'}`,
  );

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
    if (cap) {
      cap.captured = true;
      dlog('applyMove', `  CAPTURED id=${cap.id}/${cap.code} at ${captureSq}`);
    } else {
      dlog('applyMove', `  WARN capture flagged but no piece at ${captureSq}`);
    }
  }

  const moving = next.find(p => !p.captured && p.sq === from);
  if (moving) {
    moving.sq = to;
    if (move.promotion) {
      moving.code = moving.code[0] + move.promotion.toUpperCase();
    }
    dlog('applyMove', `  MOVED id=${moving.id}/${moving.code} from=${from} -> to=${to}`);
  } else {
    dlog('applyMove', `  !! BUG: NO piece found at from=${from} — visual will desync from chess.js`);
  }

  // Castling: also move the rook
  if (flags.includes('k')) {
    const rank = from[1];
    const rook = next.find(p => !p.captured && p.sq === `h${rank}`);
    if (rook) { rook.sq = `f${rank}`; dlog('applyMove', `  CASTLE-K rook ${rook.id} h${rank}->f${rank}`); }
  } else if (flags.includes('q')) {
    const rank = from[1];
    const rook = next.find(p => !p.captured && p.sq === `a${rank}`);
    if (rook) { rook.sq = `d${rank}`; dlog('applyMove', `  CASTLE-Q rook ${rook.id} a${rank}->d${rank}`); }
  }

  // Summary of where every non-captured piece is now (sorted). Lets us spot
  // any unexpected diff between two consecutive renders.
  const summary = next.filter(p => !p.captured).map(p => p.sq).sort().join(',');
  dlog('applyMove', `OUT count=${next.filter(p => !p.captured).length} sqs=${summary}`);
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
  const [moveHistory, setMoveHistoryState] = useState<MoveRecord[]>([]);
  const [lastAnalysis, setLastAnalysis] = useState<MoveAnalysis | null>(null);
  const [currentEval, setCurrentEval] = useState(0);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [playerTime, setPlayerTime] = useState<number | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [pendingRefutation, setPendingRefutation] = useState<string[] | null>(null);
  const [boardPieces, setBoardPieces] = useState<PieceData[]>(buildInitialPieces);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [captureFlash, setCaptureFlash] = useState<CaptureFlashState | null>(null);

  // Mirror of moveHistory that updates synchronously, so async callbacks
  // (engine move, deferred analysis) can read the latest history without
  // having to embed side effects inside a setState updater.
  const moveHistoryRef = useRef<MoveRecord[]>(moveHistory);
  const setMoveHistory = useCallback(
    (next: MoveRecord[] | ((prev: MoveRecord[]) => MoveRecord[])) => {
      const resolved =
        typeof next === 'function'
          ? (next as (p: MoveRecord[]) => MoveRecord[])(moveHistoryRef.current)
          : next;
      moveHistoryRef.current = resolved;
      setMoveHistoryState(resolved);
    },
    [],
  );

  // The single player clock ticks down once per second, but only while it is
  // the player's turn to move and the game is live. The coach is the computer
  // and has no clock, so its thinking time is never charged to anyone.
  const playerOnMove = status === 'playing' && fen.split(' ')[1] === playerColor;

  useEffect(() => {
    if (playerTime === null) return;     // clock disabled (No clock mode)
    if (!playerOnMove) return;           // pause while the coach is thinking
    const id = setInterval(() => {
      setPlayerTime(t => (t === null ? t : Math.max(0, t - 1)));
    }, 1000);
    return () => clearInterval(id);
  }, [playerOnMove, playerTime === null]);

  // Flag fall: if the player's clock hits zero, they lose on time.
  useEffect(() => {
    if (playerTime === 0 && status !== 'game_over' && status !== 'idle') {
      setStatus('game_over');
      setResult('loss');
    }
  }, [playerTime, status]);

  // === Diagnostic state watchers ===
  // These log every commit of boardPieces / fen / status so we can correlate
  // what React actually rendered with what the engine and our piece tracker
  // each think the position is. A desync — boardPieces says one thing, fen
  // says another — pinpoints exactly which state path is wrong.
  useEffect(() => {
    const live = boardPieces.filter(p => !p.captured);
    const sqs = live.map(p => `${p.id}:${p.sq}`).sort().join(',');
    dlog('state', `boardPieces commit count=${live.length} ${sqs}`);
  }, [boardPieces]);

  useEffect(() => {
    dlog('state', `fen commit ${fen}`);
  }, [fen]);

  useEffect(() => {
    dlog('state', `status=${status}`);
  }, [status]);

  const endGame = useCallback((res: GameResult, chessInstance: Chess, history: MoveRecord[]) => {
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
    dlog('engine', `runEngineMove scheduled (level=${level}, depth=${levelToDepth(level)})`);
    // Defer to next tick so the "Thinking..." UI updates first; then the
    // engine computes in a follow-up tick so the JS thread can interleave.
    setTimeout(() => {
      dlog('engine', `engine compute starting; chessTurn=${chess.turn()} fen=${chess.fen()}`);
      const depth = levelToDepth(level);
      // Time the search and count nodes so we can see, on the real device,
      // exactly how long the coach takes and how much work it did.
      resetSearchNodes();
      const tStart = Date.now();
      const engineResult = getBestMove(chess, depth);
      const elapsedMs = Date.now() - tStart;
      const nodes = getSearchNodes();
      const ply = chess.history().length;
      dlog('perf', `coach search level=${level} depth=${depth} ply=${ply} took=${elapsedMs}ms nodes=${nodes} (${(nodes / Math.max(1, elapsedMs)).toFixed(1)} nodes/ms)`);
      dlog('engine', `getBestMove -> san=${engineResult.san} from=${engineResult.from} to=${engineResult.to} promotion=${engineResult.promotion ?? '-'}`);
      const moveData = chess.move({
        from: engineResult.from,
        to: engineResult.to,
        promotion: engineResult.promotion,
      });
      dlog('engine', `chess.move OK san=${moveData.san} flags=${moveData.flags} captured=${moveData.captured ?? '-'}`);
      const engineFen = chess.fen();
      const engineRecord: MoveRecord = {
        san: engineResult.san,
        fen: engineFen,
        eval: 0, // filled in below
        playerMove: false,
      };
      setFen(engineFen);
      setBoardPieces(prev => {
        dlog('engine', `setBoardPieces(engine) updater fires; prev.count=${prev.filter(p => !p.captured).length}`);
        return applyMoveToPieces(prev, moveData);
      });
      setLastMove({ from: moveData.from, to: moveData.to });
      const flash = captureFlashForMove(moveData, /*isPlayerMove*/ false);
      if (flash) setCaptureFlash(flash);

      // Pure history update, then side effects outside the updater.
      const updated = [...moveHistoryRef.current, engineRecord];
      setMoveHistory(updated);
      if (chess.isGameOver()) {
        let res: GameResult = 'draw';
        if (chess.isCheckmate()) res = playerColor === chess.turn() ? 'loss' : 'win';
        endGame(res, chess, updated);
      } else {
        setStatus('playing');
      }

      // Defer eval (shallow) one more tick so the piece animation has begun
      setTimeout(() => {
        const evalNow = getEvaluation(chess, 1);
        setCurrentEval(evalNow);
      }, 0);
    }, 0);
  }, [chess, level, playerColor, endGame, setMoveHistory]);

  const startNewGame = useCallback((
    color: 'w' | 'b',
    lvl: number,
    timeControl: 'none' | '10min' | '5min',
  ) => {
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
    setPlayerTime(seconds);
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
    dlog('makeMove', `ENTRY from=${from} to=${to} promotion=${promotion ?? '-'} status=${status} chessTurn=${chess.turn()} playerColor=${playerColor}`);
    if (status !== 'playing') { dlog('makeMove', `EXIT: status=${status}`); return; }
    if (chess.turn() !== playerColor) { dlog('makeMove', `EXIT: not player's turn`); return; }

    const chessBefore = new Chess(chess.fen());

    let moveResult: any;
    try {
      moveResult = chess.move({ from, to, promotion: promotion ?? 'q' });
    } catch (e) {
      dlog('makeMove', `EXIT: chess.move threw ${String(e)}`);
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }
    dlog('makeMove', `chess.move OK san=${moveResult.san} from=${moveResult.from} to=${moveResult.to} flags=${moveResult.flags} captured=${moveResult.captured ?? '-'} promotion=${moveResult.promotion ?? '-'}`);

    // === FAST PATH: update UI immediately ===
    setSelectedSquare(null);
    setLegalMoves([]);
    const newFen = chess.fen();
    setFen(newFen);
    setBoardPieces(prev => {
      dlog('makeMove', `setBoardPieces(player) updater fires; prev.count=${prev.filter(p => !p.captured).length}`);
      return applyMoveToPieces(prev, moveResult);
    });
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

      // Pure history update, then side effects outside the updater.
      const updated = [...moveHistoryRef.current, record];
      setMoveHistory(updated);

      if (chess.isGameOver()) {
        let res: GameResult = 'draw';
        if (chess.isCheckmate()) res = playerColor === chess.turn() ? 'loss' : 'win';
        endGame(res, chess, updated);
      } else if (analysis.quality === 'blunder' || analysis.quality === 'mistake') {
        setStatus('player_blundered');
      } else {
        setStatus('engine_thinking');
        // Small thinking delay for natural feel, then engine moves
        setTimeout(() => runEngineMove(), 280 + Math.random() * 220);
      }
    }, 0);
  }, [status, chess, playerColor, endGame, runEngineMove, setMoveHistory]);

  const clearBlunderAlert = useCallback(() => {
    if (status !== 'player_blundered') return;
    setStatus('engine_thinking');
    setTimeout(() => runEngineMove(), 200);
  }, [status, runEngineMove]);

  const resign = useCallback(() => {
    setStatus('game_over');
    setResult('loss');
  }, []);

  const offerDraw = useCallback(() => {
    setStatus('game_over');
    setResult('draw');
  }, []);

  const useHint = useCallback(() => {
    setHintsUsed(h => Math.min(h + 1, MAX_HINTS));
  }, []);

  const canUndo = useCallback(() => {
    if (status === 'game_over' || status === 'idle') return false;
    if (status === 'engine_thinking') return false; // wait for engine
    // We can undo as long as the player has at least one move in history.
    return moveHistory.some(m => m.playerMove);
  }, [status, moveHistory]);

  const undoLastMove = useCallback(() => {
    if (status === 'game_over' || status === 'idle' || status === 'engine_thinking') return;
    if (moveHistory.length === 0) return;

    // Undo enough half-moves to land just BEFORE the player's last move,
    // so it becomes the player's turn again with their previous position.
    // Typical case: history ends with [..., playerMove, engineMove] → undo 2.
    // Blunder state: history ends with [..., playerMove] → undo 1.
    let undoCount = 0;
    if (moveHistory[moveHistory.length - 1].playerMove) {
      undoCount = 1;
    } else {
      // last is engine move; undo it and the player move before it
      undoCount = moveHistory.length >= 2 ? 2 : 1;
    }

    for (let i = 0; i < undoCount; i++) {
      chess.undo();
    }

    const newFen = chess.fen();
    const newHistory = moveHistory.slice(0, moveHistory.length - undoCount);

    // Restore visual board from the resulting FEN. Piece IDs are regenerated
    // (no animation across an undo — pieces snap to the restored position).
    setFen(newFen);
    setBoardPieces(piecesFromFen(newFen));
    setMoveHistory(newHistory);
    setLastAnalysis(null);
    setStatus('playing');
    setSelectedSquare(null);
    setLegalMoves([]);
    setCaptureFlash(null);

    // Recompute last-move highlight from the new tail of history
    const tail = newHistory[newHistory.length - 1];
    if (tail) {
      // Derive from/to from the SAN: not always reliable. Easier: clear the
      // highlight since undoing has no canonical "previous move".
      setLastMove(null);
    } else {
      setLastMove(null);
    }

    // Refresh eval in the background
    setTimeout(() => {
      setCurrentEval(getEvaluation(chess, 1));
    }, 0);
  }, [chess, moveHistory, status]);

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
      playerTime, hintsUsed, pendingRefutation,
      boardPieces, lastMove, captureFlash,
      startNewGame, selectSquare, makeMove, resign, offerDraw,
      useHint, clearBlunderAlert, clearCaptureFlash, loadSavedGame, saveCurrentGame,
      undoLastMove, canUndo,
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
