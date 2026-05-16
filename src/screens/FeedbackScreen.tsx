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

type Nav = NativeStackNavigationProp<RootStackParamList, 'Feedback'>;

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

export function FeedbackScreen() {
  const { colors } = useTheme();
  const nav = useNavigation<Nav>();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <AppBar left="‹" title="vs Coach" sub="Level 4" right="⏸" onLeft={() => nav.goBack()} />

      <View style={styles.body}>
        {/* Toast */}
        <View style={[styles.toast, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pill tone="warn-soft">Inaccuracy</Pill>
          <Text style={[styles.toastMove, { color: colors.ink, fontFamily: 'monospace' }]}>–0.6 · Nd2</Text>
          <View style={{ flex: 1 }} />
          <Text style={[styles.toastHint, { color: colors.inkMute }]}>tap to read</Text>
          <Text style={[styles.toastChev, { color: colors.inkMute }]}>⌄</Text>
        </View>

        {/* Board */}
        <View style={styles.boardRow}>
          <EvalBar pct={42} label="–0.6" />
          <View style={{ flex: 1 }}>
            <Board pieces={GAME_POS} highlights={[{ sq: 'd2', kind: 'warn' }]} />
          </View>
        </View>

        {/* Blunder card */}
        <Card variant="bad" loose>
          <View style={styles.blunderHeader}>
            <Pill tone="bad">Blunder</Pill>
            <Text style={[styles.blunderMeta, { color: colors.bad, fontFamily: 'monospace' }]}>–2.4 · move 8</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity>
              <Text style={[styles.dismiss, { color: colors.inkMute }]}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.blunderTitle, { color: colors.bad2, fontFamily: 'serif' }]}>
            You left the <Text style={{ fontStyle: 'italic' }}>knight</Text> unguarded.
          </Text>
          <Text style={[styles.blunderBody, { color: colors.bad2 }]}>
            The bishop on c5 can just take it — nothing's defending d6 anymore.
          </Text>
          <View style={styles.blunderBtns}>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.bad }]}
              onPress={() => nav.navigate('Refutation')}
            >
              <Text style={[styles.btnText, { color: '#fff' }]}>Show me</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.btnText, { color: colors.ink }]}>Replay line</Text>
            </TouchableOpacity>
          </View>
        </Card>

        <View style={{ flex: 1 }} />

        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.ink }]}>
          <Text style={[styles.btnText, { color: colors.surface }]}>
            <Text style={{ color: colors.inkMute, fontFamily: 'monospace', fontSize: 11 }}>···  </Text>
            Coach is thinking
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 18, paddingBottom: 18, gap: 14 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12,
  },
  toastMove: { fontSize: 12.5 },
  toastHint: { fontSize: 12 },
  toastChev: { fontSize: 16 },
  boardRow: { flexDirection: 'row', gap: 8 },
  blunderHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 8 },
  blunderMeta: { fontSize: 12 },
  dismiss: { fontSize: 16 },
  blunderTitle: { fontSize: 19, fontWeight: '500', lineHeight: 24, letterSpacing: -0.2 },
  blunderBody: { fontSize: 13, lineHeight: 20, marginTop: 6, opacity: 0.85 },
  blunderBtns: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 36,
  },
  btnText: { fontSize: 13, fontWeight: '600' },
  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    minHeight: 44,
  },
});
