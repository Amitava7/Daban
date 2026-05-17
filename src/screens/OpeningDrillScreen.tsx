import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
import { Pill } from '../components/Pill';
import {
  getOpeningById, getNextMoves, matchOpeningMove, getMoveExplanation, isDrillComplete,
} from '../engine/OpeningBook';
import { fenToPieces } from '../utils/fenUtils';

type Nav = NativeStackNavigationProp<RootStackParamList, 'OpeningDrill'>;
type Route = RouteProp<RootStackParamList, 'OpeningDrill'>;

type DrillState = 'waiting' | 'correct' | 'wrong' | 'complete' | 'engine_turn';

export function OpeningDrillScreen() {
  const { colors } = useTheme();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { openingId } = route.params;
  const { recordOpeningMove } = useProgress();

  const opening = getOpeningById(openingId);
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [played, setPlayed] = useState<string[]>([]);
  const [drillState, setDrillState] = useState<DrillState>('waiting');
  const [lastFeedback, setLastFeedback] = useState('');
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Determine if current move is for the user
  const isUserTurn = opening
    ? chess.turn() === opening.side
    : true;

  const pieces = useMemo(() => fenToPieces(fen), [fen]);
  const nextExpected = opening ? getNextMoves(opening, played) : [];
  const explanation = opening ? getMoveExplanation(opening, played) : '';

  const highlight = useMemo(() => {
    if (drillState === 'correct' && played.length > 0) {
      const lastSan = played[played.length - 1];
      const sq = lastSan.slice(-2);
      if (/^[a-h][1-8]$/.test(sq)) return [{ sq, kind: 'good' as const }];
    }
    if (drillState === 'wrong' && played.length > 0) {
      const lastSan = played[played.length - 1];
      const sq = lastSan.slice(-2);
      if (/^[a-h][1-8]$/.test(sq)) return [{ sq, kind: 'bad' as const }];
    }
    return [];
  }, [drillState, played]);

  // Engine plays the opponent's moves automatically
  useEffect(() => {
    if (!opening || drillState !== 'engine_turn') return;
    const expected = getNextMoves(opening, played);
    if (expected.length === 0) {
      setDrillState('complete');
      return;
    }
    const engineMove = expected[0];
    const timer = setTimeout(() => {
      try {
        chess.move(engineMove.san);
        const newPlayed = [...played, engineMove.san];
        setPlayed(newPlayed);
        setFen(chess.fen());
        if (isDrillComplete(opening, newPlayed)) {
          setDrillState('complete');
        } else {
          setDrillState('waiting');
        }
      } catch {
        setDrillState('complete');
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [drillState]);

  const handleSquarePress = (sq: string) => {
    if (!opening) return;
    if (!isUserTurn) return;
    if (drillState !== 'waiting') return;

    if (selectedSquare && legalMoves.includes(sq)) {
      // Attempt the move
      const chessCopy = new Chess(chess.fen());
      let moveSan: string;
      try {
        const result = chessCopy.move({ from: selectedSquare, to: sq });
        moveSan = result.san;
      } catch {
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }

      setSelectedSquare(null);
      setLegalMoves([]);

      const matched = matchOpeningMove(opening, played, moveSan);
      setTotalCount(t => t + 1);

      if (matched) {
        // Correct!
        chess.move(moveSan);
        const newPlayed = [...played, moveSan];
        setPlayed(newPlayed);
        setFen(chess.fen());
        setCorrectCount(c => c + 1);
        setLastFeedback(matched.explanation);
        setDrillState('correct');
        recordOpeningMove(openingId, true);

        setTimeout(() => {
          if (isDrillComplete(opening, newPlayed)) {
            setDrillState('complete');
          } else {
            setDrillState('engine_turn');
          }
        }, 1200);
      } else {
        // Wrong
        setLastFeedback(`Not quite. The book move is ${nextExpected[0]?.san ?? '?'}.`);
        setDrillState('wrong');
        recordOpeningMove(openingId, false);
        setTimeout(() => setDrillState('waiting'), 1800);
      }
    } else {
      // Select piece
      const piece = chess.get(sq as any);
      if (piece && piece.color === opening.side) {
        const destinations = chess.moves({ square: sq as any, verbose: true }).map((m: any) => m.to);
        setSelectedSquare(sq);
        setLegalMoves(destinations);
      } else {
        setSelectedSquare(null);
        setLegalMoves([]);
      }
    }
  };

  const resetDrill = () => {
    chess.reset();
    setFen(chess.fen());
    setPlayed([]);
    setDrillState('waiting');
    setSelectedSquare(null);
    setLegalMoves([]);
    setCorrectCount(0);
    setTotalCount(0);
  };

  if (!opening) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <AppBar left="‹" title="Drill" onLeft={() => nav.goBack()} />
        <View style={[styles.body, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: colors.inkMute }}>Opening not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const mastery = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <AppBar
        left="✕"
        title={opening.name}
        sub={`As ${opening.side === 'w' ? 'White' : 'Black'}`}
        right="↺"
        onLeft={() => nav.goBack()}
        onRight={resetDrill}
      />

      <View style={styles.body}>
        {/* Progress */}
        <View style={styles.progressRow}>
          <Text style={[styles.progressLabel, { color: colors.inkMute }]}>
            Move {played.length + 1} · {correctCount}/{totalCount} correct
          </Text>
          <View style={[styles.progressTrack, { backgroundColor: colors.surface3 }]}>
            <View style={[styles.progressFill, { width: `${mastery}%` as any, backgroundColor: colors.brand }]} />
          </View>
        </View>

        <Board
          pieces={pieces}
          highlights={highlight}
          flipped={opening.side === 'b'}
          coords
          onSquarePress={isUserTurn && drillState === 'waiting' ? handleSquarePress : undefined}
          selectedSquare={selectedSquare}
          legalMoves={legalMoves}
        />

        {/* Feedback card */}
        <Card
          variant={drillState === 'correct' ? 'good' : drillState === 'wrong' ? 'bad' : 'flat'}
          tight
        >
          {drillState === 'complete' ? (
            <View style={styles.completeContent}>
              <Text style={[styles.completeTitle, { color: colors.good2, fontFamily: 'serif' }]}>
                Line complete!
              </Text>
              <Text style={[styles.feedbackText, { color: colors.good2 }]}>
                You played through the full opening. Score: {correctCount}/{totalCount}
              </Text>
            </View>
          ) : drillState === 'correct' ? (
            <>
              <Text style={[styles.kicker, { color: colors.good }]}>Correct!</Text>
              <Text style={[styles.feedbackText, { color: colors.good2 }]}>{lastFeedback}</Text>
            </>
          ) : drillState === 'wrong' ? (
            <>
              <Text style={[styles.kicker, { color: colors.bad }]}>Not quite</Text>
              <Text style={[styles.feedbackText, { color: colors.bad2 }]}>{lastFeedback}</Text>
            </>
          ) : drillState === 'engine_turn' ? (
            <Text style={[styles.feedbackText, { color: colors.inkMute }]}>Opponent is thinking…</Text>
          ) : (
            <>
              <Text style={[styles.kicker, { color: colors.brand }]}>
                {isUserTurn ? 'Your turn — find the book move' : 'Opponent thinking…'}
              </Text>
              {explanation ? (
                <Text style={[styles.feedbackText, { color: colors.brand2 }]}>{explanation}</Text>
              ) : (
                <Text style={[styles.feedbackText, { color: colors.inkMute }]}>
                  {opening.description}
                </Text>
              )}
            </>
          )}
        </Card>

        {/* Move list */}
        <View style={[styles.moveList, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          <Text style={[styles.moveListKicker, { color: colors.inkMute }]}>Played</Text>
          <Text style={[styles.moveListText, { color: colors.ink, fontFamily: 'monospace' }]}>
            {played.length === 0
              ? '—'
              : played.map((san, i) => {
                  const num = Math.floor(i / 2) + 1;
                  return i % 2 === 0 ? `${num}. ${san}` : san;
                }).join('  ')}
          </Text>
        </View>

        <View style={{ flex: 1 }} />

        <View style={styles.btnRow}>
          {drillState === 'complete' ? (
            <>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.brand }]}
                onPress={resetDrill}
              >
                <Text style={[styles.btnText, { color: colors.onBrand }]}>Drill again</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => nav.goBack()}
              >
                <Text style={[styles.btnText, { color: colors.ink }]}>Done</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={resetDrill}
              >
                <Text style={[styles.btnText, { color: colors.ink }]}>↺ Restart</Text>
              </TouchableOpacity>
              {nextExpected[0] && (
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => {
                    // Show the correct move
                    setLastFeedback(`Book move: ${nextExpected[0].san}`);
                    setDrillState('wrong');
                    setTimeout(() => setDrillState('waiting'), 2000);
                  }}
                >
                  <Text style={[styles.btnText, { color: colors.inkMute }]}>Show move</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 18, paddingBottom: 18, gap: 12 },
  progressRow: { gap: 6 },
  progressLabel: { fontSize: 12, fontFamily: 'monospace' },
  progressTrack: { height: 4, borderRadius: 999 },
  progressFill: { height: '100%', borderRadius: 999 },
  kicker: { fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 },
  feedbackText: { fontSize: 13, lineHeight: 19 },
  completeContent: { gap: 6 },
  completeTitle: { fontSize: 20, fontWeight: '500' },
  moveList: {
    padding: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, gap: 4,
  },
  moveListKicker: { fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 1.2 },
  moveListText: { fontSize: 12, lineHeight: 18 },
  btnRow: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 12, borderWidth: 1, minHeight: 44,
  },
  btnText: { fontSize: 14, fontWeight: '600' },
});
