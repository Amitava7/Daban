import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { AppBar } from '../components/AppBar';
import { Board } from '../components/Board';
import { Card } from '../components/Card';
import { PieceData } from '../components/Board';

const BASE: Record<string, PieceData> = {
  wK: { sq: 'g1', code: 'wK' }, wRa: { sq: 'a1', code: 'wR' }, wRf: { sq: 'f1', code: 'wR' },
  wQ: { sq: 'e2', code: 'wQ' }, wBc: { sq: 'c4', code: 'wB' },
  wNf: { sq: 'f3', code: 'wN' }, wNd: { sq: 'd6', code: 'wN' },
  wPa: { sq: 'a2', code: 'wP' }, wPb: { sq: 'b2', code: 'wP' },
  wPc: { sq: 'c3', code: 'wP' }, wPd: { sq: 'd4', code: 'wP' }, wPe: { sq: 'e4', code: 'wP' },
  wPf: { sq: 'f2', code: 'wP' }, wPg: { sq: 'g2', code: 'wP' }, wPh: { sq: 'h2', code: 'wP' },
  bK: { sq: 'g8', code: 'bK' }, bRa: { sq: 'a8', code: 'bR' }, bRf: { sq: 'f8', code: 'bR' },
  bQ: { sq: 'd8', code: 'bQ' }, bBc: { sq: 'c5', code: 'bB' }, bNf: { sq: 'f6', code: 'bN' },
  bPa: { sq: 'a7', code: 'bP' }, bPb: { sq: 'b7', code: 'bP' }, bPc: { sq: 'c7', code: 'bP' },
  bPe: { sq: 'e6', code: 'bP' }, bPf: { sq: 'f7', code: 'bP' },
  bPg: { sq: 'g7', code: 'bP' }, bPh: { sq: 'h7', code: 'bP' },
};

const FRAMES = [
  {
    title: 'Your move',
    caption: 'The knight on d6 has no defender — Black takes for free.',
    pieces: BASE,
    hl: [{ sq: 'd6', kind: 'bad' as const }, { sq: 'c5', kind: 'bad' as const }],
  },
  {
    title: '1. …Bxd6',
    caption: "Bishop walks in. You're down a full knight already.",
    pieces: { ...BASE, bBc: { sq: 'd6', code: 'bB' }, wNd: { sq: 'd6', code: 'wN', captured: true } },
    hl: [{ sq: 'd6', kind: 'bad' as const }],
  },
  {
    title: '2. Qxd6 (forced)',
    caption: 'You recapture but the queen is now exposed.',
    pieces: { ...BASE, bBc: { sq: 'd6', code: 'bB', captured: true }, wNd: { sq: 'd6', code: 'wN', captured: true }, wQ: { sq: 'd6', code: 'wQ' } },
    hl: [{ sq: 'd6', kind: 'warn' as const }],
  },
  {
    title: '3. …Nxe4 — fork',
    caption: 'Knight forks queen, wins more material. Final eval: –3.0',
    pieces: { ...BASE, bBc: { sq: 'd6', code: 'bB', captured: true }, wNd: { sq: 'd6', code: 'wN', captured: true }, wQ: { sq: 'd6', code: 'wQ' }, bNf: { sq: 'e4', code: 'bN' }, wPe: { sq: 'e4', code: 'wP', captured: true } },
    hl: [{ sq: 'e4', kind: 'bad' as const }, { sq: 'd6', kind: 'bad' as const }],
  },
];

export function RefutationScreen() {
  const { colors } = useTheme();
  const nav = useNavigation();
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStep(s => (s + 1) % FRAMES.length);
    }, 2100);
    return () => clearInterval(timer);
  }, []);

  const f = FRAMES[step];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <AppBar
        left="✕"
        title="What you missed"
        sub={`Step ${step + 1} of ${FRAMES.length}`}
        right="↻"
        onLeft={() => nav.goBack()}
      />

      <View style={styles.body}>
        <View>
          <Board pieces={f.pieces} highlights={f.hl} coords />
          <View style={[styles.titleBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.titleBadgeText, { color: colors.ink, fontFamily: 'monospace' }]}>{f.title}</Text>
          </View>
        </View>

        <Card variant="brand">
          <Text style={[styles.kicker, { color: colors.brand }]}>What happens</Text>
          <Text style={[styles.caption, { color: colors.brand2, fontFamily: 'serif', fontStyle: 'italic' }]}>
            {f.caption}
          </Text>
        </Card>

        {/* Playback controls */}
        <View style={[styles.playRow, { backgroundColor: colors.surface2 }]}>
          <TouchableOpacity style={styles.playBtn} onPress={() => setStep(s => Math.max(0, s - 1))}>
            <Text style={[styles.playBtnText, { color: colors.ink2 }]}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.playBtnPrimary, { backgroundColor: colors.brand }]}
            onPress={() => setStep(0)}
          >
            <Text style={[styles.playBtnText, { color: colors.onBrand }]}>▶ replay</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.playBtn} onPress={() => setStep(s => Math.min(FRAMES.length - 1, s + 1))}>
            <Text style={[styles.playBtnText, { color: colors.ink2 }]}>›</Text>
          </TouchableOpacity>
          <View style={[styles.scrub, { backgroundColor: colors.surface3 }]}>
            <View style={[styles.scrubFill, { width: `${((step + 1) / FRAMES.length) * 100}%` as any, backgroundColor: colors.brand }]} />
          </View>
        </View>

        <View style={{ flex: 1 }} />

        <View style={styles.btnRow}>
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.btnText, { color: colors.ink }]}>Take it back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.brand }]} onPress={() => nav.goBack()}>
            <Text style={[styles.btnText, { color: colors.onBrand }]}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 18, paddingBottom: 18, gap: 14 },
  titleBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  titleBadgeText: { fontSize: 12, fontWeight: '600' },
  kicker: { fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 },
  caption: { fontSize: 17, lineHeight: 24, letterSpacing: -0.2, minHeight: 48 },
  playRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    padding: 4,
  },
  playBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  playBtnPrimary: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnText: { fontSize: 14, fontWeight: '600' },
  scrub: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    marginHorizontal: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  scrubFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    borderRadius: 999,
  },
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
