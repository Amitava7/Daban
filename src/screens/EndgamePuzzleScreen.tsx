import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Chess } from 'chess.js';
import { useTheme } from '../context/ThemeContext';
import { useProgress } from '../context/ProgressContext';
import { RootStackParamList } from '../navigation/types';
import { AppBar } from '../components/AppBar';
import { Board } from '../components/Board';
import { Card } from '../components/Card';
import { EvalBar } from '../components/EvalBar';
import { getPuzzleById } from '../engine/EndgameGenerator';
import { bestMove, evaluate as evaluatePosition } from '../engine/engine';
import { formatEval } from '../engine/MoveClassifier';
import { fenToPieces } from '../utils/fenUtils';

type Nav = NativeStackNavigationProp<RootStackParamList, 'EndgamePuzzle'>;
type Route = RouteProp<RootStackParamList, 'EndgamePuzzle'>;

type PuzzleStatus = 'playing' | 'engine_turn' | 'solved' | 'failed';

function evalBarPct(cp: number): number {
  const clamped = Math.max(-1000, Math.min(1000, cp));
  return 10 + ((clamped + 1000) / 2000) * 80;
}

export function EndgamePuzzleScreen() {
  const { colors } = useTheme();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { puzzleId } = route.params;
  const { completeEndgame } = useProgress();

  const puzzle = getPuzzleById(puzzleId);
  const [chess] = useState(() => {
    const c = new Chess();
    if (puzzle) c.load(puzzle.fen);
    return c;
  });
  const [fen, setFen] = useState(chess.fen());
  const [status, setStatus] = useState<PuzzleStatus>('playing');
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [currentEval, setCurrentEval] = useState(0);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [moveCount, setMoveCount] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [hintMove, setHintMove] = useState('');

  const pieces = useMemo(() => fenToPieces(fen), [fen]);
  const playerSide = puzzle?.playerSide ?? 'w';

  const isPlayerTurn = status === 'playing' && chess.turn() === playerSide;

  const highlights = lastMove
    ? [
        { sq: lastMove.from, kind: 'brand' as const },
        { sq: lastMove.to, kind: 'brand' as const },
      ]
    : [];

  // Initial evaluation of the puzzle position.
  useEffect(() => {
    evaluatePosition(chess.fen()).then(setCurrentEval).catch(() => {});
  }, []);

  // Engine move (full-strength Stockfish — puzzles want best play).
  useEffect(() => {
    if (status !== 'engine_turn') return;
    if (chess.isGameOver()) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await bestMove(chess.fen(), 600);
        if (cancelled) return;
        if (!result) { setStatus('playing'); return; }
        chess.move({ from: result.from, to: result.to, promotion: result.promotion });
        const newFen = chess.fen();
        setFen(newFen);
        setLastMove({ from: result.from, to: result.to });
        evaluatePosition(newFen).then(v => { if (!cancelled) setCurrentEval(v); }).catch(() => {});

        if (chess.isCheckmate()) {
          // Player won if their side is NOT the one checkmated
          if (chess.turn() !== playerSide) {
            setStatus('solved');
            completeEndgame(puzzleId);
          } else {
            setStatus('failed');
          }
        } else if (chess.isDraw()) {
          // Draw = fail unless puzzle goal was to draw
          setStatus('failed');
        } else {
          setStatus('playing');
        }
      } catch {
        if (!cancelled) setStatus('playing');
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [status]);

  const handleSquarePress = (sq: string) => {
    if (!isPlayerTurn) return;

    if (selectedSquare && legalMoves.includes(sq)) {
      try {
        const move = chess.move({ from: selectedSquare, to: sq, promotion: 'q' });
        const newFen = chess.fen();
        setFen(newFen);
        evaluatePosition(newFen).then(setCurrentEval).catch(() => {});
        setLastMove({ from: selectedSquare, to: sq });
        setSelectedSquare(null);
        setLegalMoves([]);
        setMoveCount(m => m + 1);

        if (chess.isCheckmate()) {
          if (chess.turn() !== playerSide) {
            setStatus('solved');
            completeEndgame(puzzleId);
          } else {
            setStatus('failed');
          }
        } else if (chess.isDraw()) {
          setStatus('failed');
        } else {
          setStatus('engine_turn');
        }
      } catch {
        setSelectedSquare(null);
        setLegalMoves([]);
      }
    } else {
      const piece = chess.get(sq as any);
      if (piece && piece.color === playerSide) {
        const destinations = chess.moves({ square: sq as any, verbose: true }).map((m: any) => m.to);
        setSelectedSquare(sq);
        setLegalMoves(destinations);
      } else {
        setSelectedSquare(null);
        setLegalMoves([]);
      }
    }
  };

  const getHint = async () => {
    const result = await bestMove(chess.fen(), 600);
    if (result) {
      setHintMove(result.san);
      setShowHint(true);
    }
  };

  const reset = () => {
    if (puzzle) {
      chess.load(puzzle.fen);
      setFen(chess.fen());
      setStatus('playing');
      setSelectedSquare(null);
      setLegalMoves([]);
      setLastMove(null);
      setMoveCount(0);
      evaluatePosition(chess.fen()).then(setCurrentEval).catch(() => {});
    }
  };

  if (!puzzle) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <AppBar left="‹" title="Endgame" onLeft={() => nav.goBack()} />
        <View style={[styles.body, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: colors.inkMute }}>Puzzle not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const evalPct = evalBarPct(playerSide === 'w' ? currentEval : -currentEval);
  const evalLabel = formatEval(playerSide === 'w' ? currentEval : -currentEval);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <AppBar
        left="‹"
        title={puzzle.title}
        sub={`You're ${playerSide === 'w' ? 'White' : 'Black'} · move ${moveCount + 1}`}
        right="↺"
        onLeft={() => nav.goBack()}
        onRight={reset}
      />

      <View style={styles.body}>
        {/* Board */}
        <View style={styles.boardRow}>
          <EvalBar pct={evalPct} label={evalLabel} />
          <View style={{ flex: 1 }}>
            <Board
              pieces={pieces}
              highlights={highlights}
              flipped={playerSide === 'b'}
              coords
              onSquarePress={isPlayerTurn ? handleSquarePress : undefined}
              selectedSquare={selectedSquare}
              legalMoves={legalMoves}
            />
          </View>
        </View>

        {/* Goal card */}
        <Card variant={status === 'solved' ? 'good' : status === 'failed' ? 'bad' : 'brand'} tight>
          <Text style={[styles.kicker, {
            color: status === 'solved' ? colors.good : status === 'failed' ? colors.bad : colors.brand,
          }]}>
            {status === 'solved' ? 'Solved!' : status === 'failed' ? 'Not quite' : 'Goal'}
          </Text>
          <Text style={[styles.goalText, {
            color: status === 'solved' ? colors.good2 : status === 'failed' ? colors.bad2 : colors.brand2,
            fontFamily: 'serif',
          }]}>
            {status === 'solved'
              ? `Excellent! You solved it in ${moveCount} move${moveCount !== 1 ? 's' : ''}.`
              : status === 'failed'
              ? 'The position slipped away. Try again!'
              : puzzle.goal}
          </Text>
          {status === 'engine_turn' && (
            <Text style={[styles.goalText, { color: colors.brand2 }]}>Opponent is thinking…</Text>
          )}
        </Card>

        {/* Puzzle info */}
        {status === 'playing' && (
          <Card tight>
            <Text style={[styles.kicker, { color: colors.inkMute }]}>About this endgame</Text>
            <Text style={[styles.infoText, { color: colors.inkSoft }]}>{puzzle.description}</Text>
          </Card>
        )}

        <View style={{ flex: 1 }} />

        <View style={styles.btnRow}>
          {status === 'playing' || status === 'engine_turn' ? (
            <>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={getHint}
              >
                <Text style={[styles.btnText, { color: colors.ink }]}>Hint</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={reset}
              >
                <Text style={[styles.btnText, { color: colors.ink }]}>↺ Restart</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.brand }]}
                onPress={reset}
              >
                <Text style={[styles.btnText, { color: colors.onBrand }]}>Try again</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => nav.goBack()}
              >
                <Text style={[styles.btnText, { color: colors.ink }]}>Back</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Hint modal */}
      <Modal visible={showHint} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.ink }]}>Hint</Text>
            <Text style={[styles.modalBody, { color: colors.inkSoft }]}>
              Consider: <Text style={{ fontWeight: '700', color: colors.brand }}>{hintMove}</Text>
            </Text>
            {puzzle.hint && (
              <Text style={[styles.modalBody, { color: colors.inkMute, marginTop: 4 }]}>{puzzle.hint}</Text>
            )}
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: colors.brand }]}
              onPress={() => setShowHint(false)}
            >
              <Text style={{ color: colors.onBrand, fontWeight: '600' }}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 18, paddingBottom: 18, gap: 14 },
  boardRow: { flexDirection: 'row', gap: 8 },
  kicker: { fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 },
  goalText: { fontSize: 16, fontWeight: '500', lineHeight: 22 },
  infoText: { fontSize: 13, lineHeight: 19 },
  btnRow: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 12, borderWidth: 1, minHeight: 44,
  },
  btnText: { fontSize: 14, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modal: { width: 280, borderRadius: 20, padding: 24, borderWidth: 1, gap: 12 },
  modalTitle: { fontSize: 20, fontWeight: '600', fontFamily: 'serif' },
  modalBody: { fontSize: 14, lineHeight: 20 },
  modalBtn: {
    alignItems: 'center', paddingVertical: 12, borderRadius: 12, marginTop: 4,
  },
});
