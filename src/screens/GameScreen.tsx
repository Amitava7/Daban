import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../navigation/types';
import { AppBar } from '../components/AppBar';
import { Board } from '../components/Board';
import { EvalBar } from '../components/EvalBar';
import { Pill } from '../components/Pill';
import { Card } from '../components/Card';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Game'>;

const GAME_POS = {
  wK: { sq: 'g1', code: 'wK' }, wRa: { sq: 'a1', code: 'wR' }, wRf: { sq: 'f1', code: 'wR' },
  wQ: { sq: 'e2', code: 'wQ' }, wBc: { sq: 'c4', code: 'wB' },
  wNf: { sq: 'f3', code: 'wN' }, wNe: { sq: 'e5', code: 'wN' },
  wPa: { sq: 'a2', code: 'wP' }, wPb: { sq: 'b2', code: 'wP' }, wPc: { sq: 'c3', code: 'wP' },
  wPd: { sq: 'd4', code: 'wP' }, wPe: { sq: 'e3', code: 'wP' }, wPf: { sq: 'f2', code: 'wP' },
  wPg: { sq: 'g2', code: 'wP' }, wPh: { sq: 'h2', code: 'wP' },
  bK: { sq: 'g8', code: 'bK' }, bRa: { sq: 'a8', code: 'bR' }, bRf: { sq: 'f8', code: 'bR' },
  bQ: { sq: 'd8', code: 'bQ' }, bBc: { sq: 'c5', code: 'bB' },
  bNd: { sq: 'd6', code: 'bN' }, bNf: { sq: 'f6', code: 'bN' },
  bPa: { sq: 'a7', code: 'bP' }, bPb: { sq: 'b7', code: 'bP' }, bPc: { sq: 'c7', code: 'bP' },
  bPe: { sq: 'e6', code: 'bP' }, bPf: { sq: 'f7', code: 'bP' },
  bPg: { sq: 'g7', code: 'bP' }, bPh: { sq: 'h7', code: 'bP' },
};

export function GameScreen() {
  const { colors } = useTheme();
  const nav = useNavigation<Nav>();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <AppBar
        left="‹"
        title="vs Coach"
        sub="Level 4 · 14:32"
        right="⏸"
        onLeft={() => nav.goBack()}
      />

      <View style={styles.body}>
        {/* Coach quote */}
        <View style={[styles.coachQuote, { backgroundColor: colors.brandSoft, borderColor: colors.brandTint }]}>
          <Text style={[styles.quoteMark, { color: colors.brand }]}>"</Text>
          <View style={styles.quoteContent}>
            <Text style={[styles.quoteMain, { color: colors.brand2, fontFamily: 'serif', fontStyle: 'italic' }]}>
              Strong knight on f6.
            </Text>
            <Text style={[styles.quoteSub, { color: colors.brand2 }]}>
              You're guarding e4 and eyeing d5 — keep the pressure on.
            </Text>
          </View>
          <Pill tone="good-soft">+0.4</Pill>
        </View>

        {/* Board + eval */}
        <View style={styles.boardRow}>
          <EvalBar pct={56} label="+0.4" />
          <View style={styles.boardWrap}>
            <Board pieces={GAME_POS} highlights={[{ sq: 'f6', kind: 'good' }]} coords />
          </View>
        </View>

        {/* Notation */}
        <Card variant="flat" tight style={styles.notation}>
          <Text style={[styles.notationKicker, { color: colors.inkMute }]}>Last moves</Text>
          <Text style={[styles.notationMoves, { color: colors.inkSoft, fontFamily: 'monospace' }]}>
            10. O-O Bc5   11. d3 Nf6   <Text style={{ color: colors.ink }}>12. ?</Text>
          </Text>
          <Text style={[styles.notationChev, { color: colors.inkMute }]}>›</Text>
        </Card>

        <View style={{ flex: 1 }} />

        {/* Actions */}
        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.btn, styles.btnBrand, { backgroundColor: colors.brand }]}
            onPress={() => nav.navigate('Hint')}
          >
            <Text style={[styles.btnText, { color: colors.onBrand }]}>💡 Hint</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => nav.navigate('Feedback')}
          >
            <Text style={[styles.btnText, { color: colors.ink }]}>Resign</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.btnText, { color: colors.ink }]}>½ Draw</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 18, paddingBottom: 18, gap: 14 },
  coachQuote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 14,
    paddingLeft: 44,
    borderWidth: 1,
    borderRadius: 18,
    position: 'relative',
  },
  quoteMark: {
    position: 'absolute',
    left: 10,
    top: 2,
    fontSize: 48,
    fontFamily: 'serif',
    fontStyle: 'italic',
    fontWeight: '600',
    lineHeight: 56,
  },
  quoteContent: { flex: 1 },
  quoteMain: { fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  quoteSub: { fontSize: 13, lineHeight: 18, marginTop: 4, opacity: 0.88 },
  boardRow: { flexDirection: 'row', gap: 8 },
  boardWrap: { flex: 1 },
  notation: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  notationKicker: { fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 1.2 },
  notationMoves: { flex: 1, fontSize: 12 },
  notationChev: { fontSize: 18 },
  btnRow: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 44,
  },
  btnBrand: { borderWidth: 0 },
  btnText: { fontSize: 14, fontWeight: '600' },
});
