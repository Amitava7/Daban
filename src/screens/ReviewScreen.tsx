import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useGame } from '../context/GameContext';
import { AppBar } from '../components/AppBar';
import { Board } from '../components/Board';
import { Pill } from '../components/Pill';
import { Card } from '../components/Card';
import { Sparkline } from '../components/Sparkline';
import { fenToPieces } from '../utils/fenUtils';
import { formatEval, qualityLabel, qualityTone } from '../engine/MoveClassifier';

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function ReviewScreen() {
  const { colors } = useTheme();
  const nav = useNavigation();
  const { moveHistory, playerColor } = useGame();
  const [marker, setMarker] = useState(
    moveHistory.length > 0 ? moveHistory.length - 1 : 0
  );

  // Build eval data: position 0 = start (0 cp), then each move
  const evalData = useMemo(() => {
    const data = [0, ...moveHistory.map(m => m.eval / 100)];
    return data.length > 0 ? data : [0];
  }, [moveHistory]);

  const currentMove = moveHistory[marker];
  const currentFen = currentMove?.fen ?? INITIAL_FEN;
  const pieces = useMemo(() => fenToPieces(currentFen), [currentFen]);
  const evalVal = evalData[marker + 1] ?? 0;
  const analysis = currentMove?.analysis;

  // Find worst blunder
  const worstBlunder = useMemo(() => {
    return moveHistory
      .filter(m => m.playerMove && m.analysis)
      .sort((a, b) => b.analysis!.centipawnLoss - a.analysis!.centipawnLoss)[0];
  }, [moveHistory]);

  const blunders = moveHistory.filter(m => m.playerMove && m.analysis?.quality === 'blunder').length;
  const mistakes = moveHistory.filter(m => m.playerMove && m.analysis?.quality === 'mistake').length;
  const accuracy = useMemo(() => {
    const losses = moveHistory.filter(m => m.playerMove && m.analysis).map(m => m.analysis!.centipawnLoss);
    if (losses.length === 0) return 100;
    return Math.max(0, Math.round(100 - losses.reduce((a, b) => a + b, 0) / losses.length / 6));
  }, [moveHistory]);

  const highlights = currentMove && analysis
    ? [{ sq: currentMove.san.slice(-2), kind: qualityTone(analysis.quality) as any }].filter(h => /^[a-h][1-8]$/.test(h.sq))
    : [];

  const evalPill = evalVal > 0.3 ? 'good-soft' : evalVal < -0.3 ? 'bad-soft' : 'warn-soft';

  if (moveHistory.length === 0) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <AppBar left="‹" title="Game review" onLeft={() => nav.goBack()} />
        <View style={[styles.body, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: colors.inkMute, fontSize: 15 }}>No game to review yet.</Text>
          <Text style={{ color: colors.inkMute, fontSize: 13, marginTop: 8 }}>Finish a game first.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <AppBar
        left="‹"
        title="Game review"
        sub={`Move ${marker + 1} / ${moveHistory.length}`}
        right="↗"
        onLeft={() => nav.goBack()}
      />

      <View style={styles.body}>
        <View>
          <Board
            pieces={pieces}
            highlights={highlights}
            flipped={playerColor === 'b'}
            coords
          />
          <View style={styles.evalBadge}>
            <Pill tone={evalPill as any}>
              {analysis
                ? `${qualityLabel(analysis.quality)} · ${formatEval(currentMove.eval)}`
                : formatEval(currentMove?.eval ?? 0)}
            </Pill>
          </View>
        </View>

        {/* Eval graph */}
        <Card tight>
          <View style={styles.graphLabels}>
            <Text style={[styles.graphLabel, { color: colors.inkMute }]}>+5</Text>
            <Text style={[styles.graphLabel, { color: colors.inkSoft }]}>
              {moveHistory.length} moves · acc {accuracy}%
            </Text>
            <Text style={[styles.graphLabel, { color: colors.inkMute }]}>–5</Text>
          </View>
          <Sparkline
            data={evalData.map(v => Math.max(-5, Math.min(5, v)))}
            color={colors.ink}
            fill={colors.brand}
            height={68}
          />
          <Slider
            style={{ width: '100%', height: 28, marginTop: 4 }}
            minimumValue={0}
            maximumValue={Math.max(1, moveHistory.length - 1)}
            step={1}
            value={marker}
            onValueChange={v => setMarker(Math.round(v))}
            minimumTrackTintColor={colors.brand}
            maximumTrackTintColor={colors.surface3}
            thumbTintColor={colors.ink}
          />
          <View style={styles.phaseLabels}>
            <Text style={[styles.phaseLabel, { color: colors.inkMute }]}>opening</Text>
            <Text style={[styles.phaseLabel, { color: colors.inkMute }]}>middlegame</Text>
            <Text style={[styles.phaseLabel, { color: colors.inkMute }]}>endgame</Text>
          </View>
        </Card>

        {/* Pattern / move comment */}
        {analysis && (
          <Card variant="brand" tight>
            <Text style={[styles.kicker, { color: colors.brand }]}>
              {currentMove.playerMove ? 'Your move' : 'Engine move'}
            </Text>
            <Text style={[styles.patternText, { color: colors.brand2 }]}>
              <Text style={{ fontWeight: '700' }}>{currentMove.san}</Text>
              {' · '}{analysis.explanation}
            </Text>
          </Card>
        )}

        {/* Stats summary */}
        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.bad, fontFamily: 'monospace' }]}>{blunders}</Text>
            <Text style={[styles.statLabel, { color: colors.inkMute }]}>Blunders</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.warn, fontFamily: 'monospace' }]}>{mistakes}</Text>
            <Text style={[styles.statLabel, { color: colors.inkMute }]}>Mistakes</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.good, fontFamily: 'monospace' }]}>{accuracy}%</Text>
            <Text style={[styles.statLabel, { color: colors.inkMute }]}>Accuracy</Text>
          </View>
        </View>

        <View style={{ flex: 1 }} />

        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setMarker(m => Math.max(0, m - 1))}
          >
            <Text style={[styles.btnText, { color: colors.ink }]}>‹ prev</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.brand }]}
            onPress={() => nav.navigate('ColorPicker' as never)}
          >
            <Text style={[styles.btnText, { color: colors.onBrand }]}>New game</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setMarker(m => Math.min(moveHistory.length - 1, m + 1))}
          >
            <Text style={[styles.btnText, { color: colors.ink }]}>next ›</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 18, paddingBottom: 18, gap: 14 },
  evalBadge: { position: 'absolute', top: 12, right: 12 },
  graphLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  graphLabel: { fontSize: 11, fontFamily: 'monospace' },
  phaseLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  phaseLabel: { fontSize: 10, fontFamily: 'monospace' },
  kicker: { fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 },
  patternText: { fontSize: 13, lineHeight: 19 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statBox: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderWidth: 1, borderRadius: 12,
  },
  statValue: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 11, marginTop: 2 },
  btnRow: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, borderRadius: 10, borderWidth: 1, minHeight: 36,
  },
  btnText: { fontSize: 13, fontWeight: '600' },
});
