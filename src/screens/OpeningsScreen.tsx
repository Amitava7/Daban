import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../context/ThemeContext';
import { useProgress } from '../context/ProgressContext';
import { RootStackParamList } from '../navigation/types';
import { AppBar } from '../components/AppBar';
import { Board } from '../components/Board';
import { Card } from '../components/Card';
import { Pill } from '../components/Pill';
import { OPENINGS } from '../engine/OpeningBook';
import { fenToPieces } from '../utils/fenUtils';
import { Chess } from 'chess.js';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Openings'>;

function getMastery(played: number, correct: number): number {
  if (played === 0) return 0;
  return Math.round((correct / played) * 100);
}

function getOpeningFen(openingId: string): string {
  const opening = OPENINGS.find(o => o.id === openingId);
  if (!opening) return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const chess = new Chess();
  const playLine = (moves: typeof opening.moves) => {
    for (const m of moves) {
      try { chess.move(m.san); } catch { break; }
      if (m.children.length === 0) break;
      playLine(m.children);
      break; // only follow first child
    }
  };
  playLine(opening.moves);
  return chess.fen();
}

function OpeningRow({
  id, name, side, onPress, played, correct,
}: {
  id: string; name: string; side: 'w' | 'b';
  onPress: () => void; played: number; correct: number;
}) {
  const { colors } = useTheme();
  const mastery = getMastery(played, correct);
  const good = mastery >= 70;

  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: colors.ink }]}>{name}</Text>
        <Text style={[styles.rowMeta, { color: colors.inkSoft }]}>
          As {side === 'w' ? 'White' : 'Black'} · {played} drilled
        </Text>
        <View style={[styles.progressTrack, { backgroundColor: colors.surface3, marginTop: 6 }]}>
          <View style={[styles.progressFill, { width: `${mastery}%` as any, backgroundColor: good ? colors.good : colors.brand }]} />
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.pct, { color: good ? colors.good : colors.ink, fontFamily: 'monospace' }]}>{mastery}%</Text>
        <Text style={[styles.pctLabel, { color: colors.inkMute }]}>mastery</Text>
      </View>
      <Text style={[styles.chev, { color: colors.inkMute }]}>›</Text>
    </TouchableOpacity>
  );
}

export function OpeningsScreen() {
  const { colors } = useTheme();
  const nav = useNavigation<Nav>();
  const { openingMastery } = useProgress();

  // Find weakest opening (lowest mastery)
  const recommended = useMemo(() => {
    return OPENINGS.map(o => {
      const m = openingMastery[o.id] ?? { played: 0, correct: 0 };
      return { ...o, mastery: getMastery(m.played, m.correct) };
    }).sort((a, b) => a.mastery - b.mastery)[0];
  }, [openingMastery]);

  const recFen = useMemo(() => getOpeningFen(recommended?.id ?? ''), [recommended]);
  const recPieces = useMemo(() => fenToPieces(recFen), [recFen]);
  const recMastery = openingMastery[recommended?.id ?? ''] ?? { played: 0, correct: 0 };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <AppBar left="‹" title="Openings" right="+" onLeft={() => nav.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Recommendation */}
        {recommended && (
          <Card variant="brand" loose>
            <Text style={[styles.kicker, { color: colors.brand }]}>
              {getMastery(recMastery.played, recMastery.correct) === 0 ? 'Start here' : 'Recommended · weakness'}
            </Text>
            <Text style={[styles.recTitle, { color: colors.brand2, fontFamily: 'serif' }]}>
              {recommended.name}
            </Text>
            <Text style={[styles.recSub, { color: colors.brand2 }]}>
              {recMastery.played === 0
                ? 'You haven\'t practiced this opening yet.'
                : `${getMastery(recMastery.played, recMastery.correct)}% mastery — keep drilling.`}
            </Text>

            <View style={styles.recContent}>
              <View style={{ width: 124 }}>
                <Board pieces={recPieces} flipped={recommended.side === 'b'} />
              </View>
              <View style={styles.recMoves}>
                {recommended.moves.slice(0, 3).map((m, i) => (
                  <Text key={i} style={[styles.moveLine, { color: colors.brand2, fontFamily: 'monospace' }]}>
                    {i + 1}. {m.san}
                    {m.children[0] ? `  ${m.children[0].san}` : ''}
                  </Text>
                ))}
                <Text style={[styles.masteryLabel, { color: colors.brand2 }]}>Mastery</Text>
                <View style={[styles.masteryTrack, { backgroundColor: 'rgba(0,0,0,0.08)' }]}>
                  <View style={[styles.masteryFill, {
                    backgroundColor: colors.brand,
                    width: `${getMastery(recMastery.played, recMastery.correct)}%`,
                  }]} />
                </View>
              </View>
            </View>

            <View style={styles.recBtns}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.brand }]}
                onPress={() => nav.navigate('OpeningDrill', { openingId: recommended.id })}
              >
                <Text style={[styles.btnText, { color: colors.onBrand }]}>Start drill</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnOutline, { borderColor: colors.brand }]}>
                <Text style={[styles.btnText, { color: colors.brand2 }]}>Skip</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Library */}
        <View style={styles.libraryHeader}>
          <Text style={[styles.libraryTitle, { color: colors.ink, fontFamily: 'serif' }]}>All openings</Text>
          <Text style={[styles.kicker, { color: colors.inkMute }]}>{OPENINGS.length} openings</Text>
        </View>

        {OPENINGS.map(o => {
          const m = openingMastery[o.id] ?? { played: 0, correct: 0 };
          return (
            <OpeningRow
              key={o.id}
              id={o.id}
              name={o.name}
              side={o.side}
              played={m.played}
              correct={m.correct}
              onPress={() => nav.navigate('OpeningDrill', { openingId: o.id })}
            />
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 18, gap: 14 },
  kicker: { fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 },
  recTitle: { fontSize: 26, fontWeight: '500', lineHeight: 28, letterSpacing: -0.5, marginVertical: 4 },
  recSub: { fontSize: 13, opacity: 0.85, marginBottom: 12 },
  recContent: { flexDirection: 'row', gap: 14 },
  recMoves: { flex: 1, gap: 2 },
  moveLine: { fontSize: 12, lineHeight: 20 },
  masteryLabel: { fontSize: 11, marginTop: 10, opacity: 0.7 },
  masteryTrack: { height: 4, borderRadius: 2, marginTop: 4 },
  masteryFill: { height: '100%', borderRadius: 2 },
  recBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, minHeight: 44 },
  btnOutline: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, minHeight: 44, borderWidth: 1, backgroundColor: 'transparent' },
  btnText: { fontSize: 14, fontWeight: '600' },
  libraryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 },
  libraryTitle: { fontSize: 18, fontWeight: '500' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingHorizontal: 14, borderWidth: 1, borderRadius: 12 },
  rowTitle: { fontSize: 14, fontWeight: '600', lineHeight: 18 },
  rowMeta: { fontSize: 12, marginTop: 2 },
  progressTrack: { height: 3, borderRadius: 999 },
  progressFill: { height: '100%', borderRadius: 999 },
  pct: { fontSize: 13, fontWeight: '600' },
  pctLabel: { fontSize: 11, marginTop: 2 },
  chev: { fontSize: 18 },
});
