import React from 'react';
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
import {
  CATEGORY_META, getPuzzlesByCategory, EndgameCategory, getAllPuzzles,
} from '../engine/EndgameGenerator';
import { fenToPieces } from '../utils/fenUtils';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Endgames'>;

const CATEGORIES: EndgameCategory[] = ['basic_mates', 'pawn_endings', 'rook_endings', 'minor_pieces'];

function CategoryRow({
  category, done, total, current, onPress,
}: {
  category: EndgameCategory; done: number; total: number; current?: boolean; onPress: () => void;
}) {
  const { colors } = useTheme();
  const pct = total > 0 ? (done / total) * 100 : 0;
  const meta = CATEGORY_META[category];

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.row,
        { backgroundColor: current ? colors.brandSoft : colors.surface, borderColor: current ? colors.brand : colors.border },
      ]}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[styles.rowTitle, { color: colors.ink }]}>{meta.name}</Text>
          {current && <Pill tone="outlined-brand"><Text>resume</Text></Pill>}
        </View>
        <Text style={[styles.rowMeta, { color: colors.inkSoft, fontFamily: 'monospace' }]}>
          {done} / {total} solved
        </Text>
      </View>
      <View style={{ width: 64, marginRight: 8 }}>
        <View style={[styles.progressTrack, { backgroundColor: colors.surface3 }]}>
          <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: colors.brand }]} />
        </View>
      </View>
      <Text style={[styles.chev, { color: colors.inkMute }]}>›</Text>
    </TouchableOpacity>
  );
}

export function EndgamesScreen() {
  const { colors } = useTheme();
  const nav = useNavigation<Nav>();
  const { endgameCompleted } = useProgress();

  // Today's pick: first unsolved puzzle
  const todaysPuzzle = getAllPuzzles().find(p => !endgameCompleted[p.id])
    ?? getAllPuzzles()[0];
  const todayPieces = todaysPuzzle ? fenToPieces(todaysPuzzle.fen) : {};

  const getCategoryProgress = (cat: EndgameCategory) => {
    const puzzles = getPuzzlesByCategory(cat);
    const done = puzzles.filter(p => endgameCompleted[p.id]).length;
    return { done, total: puzzles.length };
  };

  // Find current category (first with progress)
  const currentCategory = CATEGORIES.find(cat => {
    const { done, total } = getCategoryProgress(cat);
    return done > 0 && done < total;
  }) ?? CATEGORIES[0];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <AppBar left="‹" title="Endgames" right="+" onLeft={() => nav.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Today's pick */}
        {todaysPuzzle && (
          <Card variant="brand" loose>
            <View style={styles.pickHeader}>
              <Text style={[styles.kicker, { color: colors.brand }]}>
                {endgameCompleted[todaysPuzzle.id] ? 'Completed ✓' : `Today · ${CATEGORY_META[todaysPuzzle.category].name}`}
              </Text>
              <Pill tone="outlined-brand"><Text>essential</Text></Pill>
            </View>
            <Text style={[styles.pickTitle, { color: colors.brand2, fontFamily: 'serif' }]}>
              {todaysPuzzle.title}
            </Text>
            <Text style={[styles.pickSub, { color: colors.brand2 }]}>
              {todaysPuzzle.description}
            </Text>

            <View style={styles.pickContent}>
              <View style={{ width: 140 }}>
                <Board
                  pieces={todayPieces}
                  flipped={todaysPuzzle.playerSide === 'b'}
                  coords
                />
              </View>
              <View style={styles.pickInfo}>
                <Text style={[styles.pickRole, { color: colors.brand2, fontFamily: 'serif' }]}>
                  You're {todaysPuzzle.playerSide === 'w' ? 'White' : 'Black'}
                </Text>
                <Text style={[styles.pickGoal, { color: colors.brand2 }]}>{todaysPuzzle.goal}</Text>
                {todaysPuzzle.hint && (
                  <Text style={[styles.pickNote, { color: colors.brand2 }]}>
                    Hint: {todaysPuzzle.hint}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.pickBtns}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.brand }]}
                onPress={() => nav.navigate('EndgamePuzzle', { puzzleId: todaysPuzzle.id })}
              >
                <Text style={[styles.btnText, { color: colors.onBrand }]}>
                  {endgameCompleted[todaysPuzzle.id] ? 'Retry ▶' : 'Solve ▶'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnOutline, { borderColor: colors.brand }]}>
                <Text style={[styles.btnText, { color: colors.brand2 }]}>Skip</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        <Text style={[styles.sectionTitle, { color: colors.ink, fontFamily: 'serif' }]}>Categories</Text>

        {CATEGORIES.map(cat => {
          const { done, total } = getCategoryProgress(cat);
          return (
            <CategoryRow
              key={cat}
              category={cat}
              done={done}
              total={total}
              current={cat === currentCategory}
              onPress={() => {
                const first = getPuzzlesByCategory(cat).find(p => !endgameCompleted[p.id])
                  ?? getPuzzlesByCategory(cat)[0];
                if (first) nav.navigate('EndgamePuzzle', { puzzleId: first.id });
              }}
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
  kicker: { fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 1.2 },
  pickHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  pickTitle: { fontSize: 26, fontWeight: '500', lineHeight: 28, letterSpacing: -0.5, marginVertical: 4 },
  pickSub: { fontSize: 13, opacity: 0.85, marginBottom: 12 },
  pickContent: { flexDirection: 'row', gap: 14 },
  pickInfo: { flex: 1, gap: 4 },
  pickRole: { fontSize: 16, fontWeight: '500' },
  pickGoal: { fontSize: 12 },
  pickNote: { fontSize: 11.5, opacity: 0.75, marginTop: 8 },
  pickBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, minHeight: 44 },
  btnOutline: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, minHeight: 44, borderWidth: 1, backgroundColor: 'transparent' },
  btnText: { fontSize: 14, fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: '500', marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingHorizontal: 14, borderWidth: 1, borderRadius: 12 },
  rowTitle: { fontSize: 14, fontWeight: '600', lineHeight: 18 },
  rowMeta: { fontSize: 12, marginTop: 2 },
  progressTrack: { height: 4, borderRadius: 999 },
  progressFill: { height: '100%', borderRadius: 999 },
  chev: { fontSize: 18 },
});
