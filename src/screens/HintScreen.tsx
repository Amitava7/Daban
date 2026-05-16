import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { AppBar } from '../components/AppBar';
import { Board } from '../components/Board';
import { Card } from '../components/Card';
import { Pill } from '../components/Pill';

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

const HINTS = [
  { mv: 'Nxe5', ev: '+1.2', from: 'f3', to: 'e5', why: 'Forks the queen on d8 and bishop on c5 — wins material outright.' },
  { mv: 'Bxf7+', ev: '+0.7', from: 'c4', to: 'f7', why: 'Cracks the kingside. King is forced to move and lose castling rights.' },
  { mv: 'O-O',  ev: '+0.1', from: 'e1', to: 'g1', why: 'King safety. Slower but principled — your structure is already better.' },
];

export function HintScreen() {
  const { colors } = useTheme();
  const nav = useNavigation();
  const [visibleCount, setVisibleCount] = useState(0);
  const [activeHint, setActiveHint] = useState(0);

  useEffect(() => {
    const timers = HINTS.map((_, i) =>
      setTimeout(() => setVisibleCount(i + 1), i * 900 + 400)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const hintColors = [colors.brand, colors.warn, colors.good];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <AppBar left="✕" title="Hint" sub="2 of 3 hints left" right="ⓘ" onLeft={() => nav.goBack()} />

      <View style={styles.body}>
        <Board
          pieces={GAME_POS}
          highlights={[{ sq: HINTS[activeHint].from, kind: 'good' }]}
        />

        <Card tight>
          {HINTS.map((h, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.legendRow, visibleCount <= i && styles.dim]}
              onPress={() => setActiveHint(i)}
            >
              <View style={[styles.bar, { backgroundColor: hintColors[i], opacity: visibleCount > i ? 1 : 0 }]} />
              <Text style={[styles.rank, { color: hintColors[i], fontFamily: 'serif', fontStyle: 'italic' }]}>{i + 1}</Text>
              <Text style={[styles.move, { color: colors.ink, fontFamily: 'serif', fontWeight: '500' }]}>{h.mv}</Text>
              <Text style={[styles.eval, { color: hintColors[i], fontFamily: 'monospace' }]}>{h.ev}</Text>
            </TouchableOpacity>
          ))}

          <View style={[styles.whyRow, { borderTopColor: colors.divider }]}>
            <Pill tone="outlined" style={{ borderColor: hintColors[activeHint] }}>
              <Text style={{ color: hintColors[activeHint] }}>why {HINTS[activeHint].mv}?</Text>
            </Pill>
            <Text style={[styles.whyText, { color: colors.ink2 }]}>{HINTS[activeHint].why}</Text>
          </View>
        </Card>

        <View style={{ flex: 1 }} />

        <View style={styles.btnRow}>
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.btnText, { color: colors.ink }]}>Hide arrows</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.brand }]}>
            <Text style={[styles.btnText, { color: colors.onBrand }]}>Play {HINTS[activeHint].mv}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 18, paddingBottom: 18, gap: 14 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  dim: { opacity: 0.32 },
  bar: { width: 28, height: 4, borderRadius: 2 },
  rank: { fontSize: 20, width: 18, lineHeight: 24 },
  move: { flex: 1, fontSize: 17, letterSpacing: -0.2 },
  eval: { fontSize: 13, fontWeight: '500' },
  whyRow: {
    borderTopWidth: 1,
    marginTop: 4,
    paddingTop: 10,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  whyText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
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
  btnText: { fontSize: 14, fontWeight: '600' },
});
