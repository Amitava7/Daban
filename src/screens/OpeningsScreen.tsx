import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { AppBar } from '../components/AppBar';
import { Board } from '../components/Board';
import { Card } from '../components/Card';
import { Pill } from '../components/Pill';

const CARO_KANN = {
  wK: { sq: 'e1', code: 'wK' }, wQ: { sq: 'd1', code: 'wQ' }, wBc: { sq: 'c1', code: 'wB' }, wBf: { sq: 'f1', code: 'wB' },
  wNb: { sq: 'b1', code: 'wN' }, wNg: { sq: 'g1', code: 'wN' }, wRa: { sq: 'a1', code: 'wR' }, wRh: { sq: 'h1', code: 'wR' },
  wPa: { sq: 'a2', code: 'wP' }, wPb: { sq: 'b2', code: 'wP' }, wPc: { sq: 'c2', code: 'wP' },
  wPd: { sq: 'd4', code: 'wP' }, wPe: { sq: 'e5', code: 'wP' },
  wPf: { sq: 'f2', code: 'wP' }, wPg: { sq: 'g2', code: 'wP' }, wPh: { sq: 'h2', code: 'wP' },
  bK: { sq: 'e8', code: 'bK' }, bQ: { sq: 'd8', code: 'bQ' }, bBc: { sq: 'c8', code: 'bB' }, bBf: { sq: 'f8', code: 'bB' },
  bNb: { sq: 'b8', code: 'bN' }, bNg: { sq: 'g8', code: 'bN' }, bRa: { sq: 'a8', code: 'bR' }, bRh: { sq: 'h8', code: 'bR' },
  bPa: { sq: 'a7', code: 'bP' }, bPb: { sq: 'b7', code: 'bP' }, bPc: { sq: 'c6', code: 'bP' },
  bPd: { sq: 'd5', code: 'bP' },
  bPe: { sq: 'e7', code: 'bP' }, bPf: { sq: 'f7', code: 'bP' }, bPg: { sq: 'g7', code: 'bP' }, bPh: { sq: 'h7', code: 'bP' },
};

const LIBRARY = [
  { name: 'Italian Game', sub: 'As white · main line', pct: 62, good: false },
  { name: 'Ruy Lopez', sub: 'As white · Berlin', pct: 40, good: false },
  { name: 'London System', sub: 'As white · solid', pct: 88, good: true },
  { name: 'Sicilian Najdorf', sub: 'As black', pct: 12, good: false },
];

function OpeningRow({ name, sub, pct, good }: { name: string; sub: string; pct: number; good: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: colors.ink }]}>{name}</Text>
        <Text style={[styles.rowMeta, { color: colors.inkSoft }]}>{sub}</Text>
        <View style={[styles.progressTrack, { backgroundColor: colors.surface3, marginTop: 6 }]}>
          <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: good ? colors.good : colors.brand }]} />
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.pct, { color: good ? colors.good : colors.ink, fontFamily: 'monospace' }]}>{pct}%</Text>
        <Text style={[styles.pctLabel, { color: colors.inkMute }]}>mastery</Text>
      </View>
      <Text style={[styles.chev, { color: colors.inkMute }]}>›</Text>
    </View>
  );
}

export function OpeningsScreen() {
  const { colors } = useTheme();
  const nav = useNavigation();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <AppBar left="‹" title="Openings" right="+" onLeft={() => nav.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Recommendation */}
        <Card variant="brand" loose>
          <Text style={[styles.kicker, { color: colors.brand }]}>Recommended · weakness</Text>
          <Text style={[styles.recTitle, { color: colors.brand2, fontFamily: 'serif' }]}>
            Caro-Kann <Text style={{ fontStyle: 'italic', fontWeight: '400' }}>Advance</Text>
          </Text>
          <Text style={[styles.recSub, { color: colors.brand2 }]}>You stumbled in this line <Text style={{ fontWeight: '700' }}>3 times</Text> last week.</Text>

          <View style={styles.recContent}>
            <View style={{ width: 124 }}>
              <Board pieces={CARO_KANN} highlights={[{ sq: 'd5', kind: 'good' }, { sq: 'e5', kind: 'good' }]} />
            </View>
            <View style={styles.recMoves}>
              {['1. e4 c6', '2. d4 d5', '3. e5  locks center'].map((line, i) => (
                <Text key={i} style={[styles.moveLine, { color: colors.brand2, fontFamily: 'monospace' }]}>{line}</Text>
              ))}
              <Text style={[styles.masteryLabel, { color: colors.brand2 }]}>Mastery</Text>
              <View style={[styles.masteryTrack, { backgroundColor: 'rgba(0,0,0,0.08)' }]}>
                <View style={[styles.masteryFill, { backgroundColor: colors.brand, width: '32%' }]} />
              </View>
            </View>
          </View>

          <View style={styles.recBtns}>
            <TouchableOpacity style={[styles.btn, { backgroundColor: colors.brand }]}>
              <Text style={[styles.btnText, { color: colors.onBrand }]}>Start drill · 5 min</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnOutline, { borderColor: colors.brand }]}>
              <Text style={[styles.btnText, { color: colors.brand2 }]}>Skip</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Library header */}
        <View style={styles.libraryHeader}>
          <Text style={[styles.libraryTitle, { color: colors.ink, fontFamily: 'serif' }]}>Or browse</Text>
          <Text style={[styles.kicker, { color: colors.inkMute }]}>18 openings</Text>
        </View>

        {LIBRARY.map(o => <OpeningRow key={o.name} {...o} />)}
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
