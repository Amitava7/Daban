import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { AppBar } from '../components/AppBar';
import { Board } from '../components/Board';
import { Card } from '../components/Card';
import { Pill } from '../components/Pill';

const KPK = {
  wK: { sq: 'e3', code: 'wK' },
  wP: { sq: 'e4', code: 'wP' },
  bK: { sq: 'e6', code: 'bK' },
};

const CATEGORIES = [
  { name: 'Basic mates', done: '3 / 5' },
  { name: 'Pawn endings', done: '1 / 8', current: true },
  { name: 'Rook endings', done: '0 / 6' },
  { name: 'Minor pieces', done: '0 / 4' },
];

function CategoryRow({ name, done, current }: { name: string; done: string; current?: boolean }) {
  const { colors } = useTheme();
  const [n, total] = done.split(' / ').map(Number);
  const pct = (n / total) * 100;

  return (
    <View style={[
      styles.row,
      { backgroundColor: current ? colors.brandSoft : colors.surface, borderColor: current ? colors.brand : colors.border },
    ]}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[styles.rowTitle, { color: colors.ink }]}>{name}</Text>
          {current && <Pill tone="outlined-brand"><Text>resume</Text></Pill>}
        </View>
        <Text style={[styles.rowMeta, { color: colors.inkSoft, fontFamily: 'monospace' }]}>{done}</Text>
      </View>
      <View style={{ width: 64, marginRight: 8 }}>
        <View style={[styles.progressTrack, { backgroundColor: colors.surface3 }]}>
          <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: colors.brand }]} />
        </View>
      </View>
      <Text style={[styles.chev, { color: colors.inkMute }]}>›</Text>
    </View>
  );
}

export function EndgamesScreen() {
  const { colors } = useTheme();
  const nav = useNavigation();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <AppBar left="‹" title="Endgames" right="+" onLeft={() => nav.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Today's pick */}
        <Card variant="brand" loose>
          <View style={styles.pickHeader}>
            <Text style={[styles.kicker, { color: colors.brand }]}>Today · 3 min</Text>
            <Pill tone="outlined-brand"><Text>essential</Text></Pill>
          </View>
          <Text style={[styles.pickTitle, { color: colors.brand2, fontFamily: 'serif' }]}>
            K + P <Text style={{ fontStyle: 'italic', fontWeight: '400' }}>vs</Text> K
          </Text>
          <Text style={[styles.pickSub, { color: colors.brand2 }]}>
            The square rule. Promote the pawn — and don't let the king cut you off.
          </Text>

          <View style={styles.pickContent}>
            <View style={{ width: 140 }}>
              <Board pieces={KPK} highlights={[{ sq: 'e4', kind: 'good' }]} coords />
            </View>
            <View style={styles.pickInfo}>
              <Text style={[styles.pickRole, { color: colors.brand2, fontFamily: 'serif' }]}>You're White</Text>
              <Text style={[styles.pickGoal, { color: colors.brand2 }]}>Goal: queen the pawn.</Text>
              <Text style={[styles.pickNote, { color: colors.brand2 }]}>
                Coach is on. Hints & refutations work like in a real game.
              </Text>
            </View>
          </View>

          <View style={styles.pickBtns}>
            <TouchableOpacity style={[styles.btn, { backgroundColor: colors.brand }]}>
              <Text style={[styles.btnText, { color: colors.onBrand }]}>Solve ▶</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnOutline, { borderColor: colors.brand }]}>
              <Text style={[styles.btnText, { color: colors.brand2 }]}>Skip</Text>
            </TouchableOpacity>
          </View>
        </Card>

        <Text style={[styles.sectionTitle, { color: colors.ink, fontFamily: 'serif' }]}>Categories</Text>

        {CATEGORIES.map(c => <CategoryRow key={c.name} {...c} />)}
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
