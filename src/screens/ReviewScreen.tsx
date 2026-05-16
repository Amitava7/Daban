import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { AppBar } from '../components/AppBar';
import { Board } from '../components/Board';
import { Pill } from '../components/Pill';
import { Card } from '../components/Card';
import { Sparkline } from '../components/Sparkline';

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

const EVAL_DATA = [0, 0.3, 0.4, 0.5, 0.3, -0.2, -2.4, -2.0, -1.4, -0.8, 0.4, 1.2, 1.8, 2.6, 3.4, 4.2, 5.0];

export function ReviewScreen() {
  const { colors } = useTheme();
  const nav = useNavigation();
  const [marker, setMarker] = useState(6);

  const evalVal = EVAL_DATA[marker];
  const isBlunder = marker === 6;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <AppBar left="‹" title="Game review" sub={`Move ${marker + 1} / ${EVAL_DATA.length}`} right="↗" onLeft={() => nav.goBack()} />

      <View style={styles.body}>
        <View>
          <Board
            pieces={GAME_POS}
            highlights={isBlunder ? [{ sq: 'd6', kind: 'bad' }] : []}
            coords
          />
          <View style={styles.evalBadge}>
            <Pill tone={isBlunder ? 'bad' : evalVal > 0 ? 'good-soft' : 'warn-soft'}>
              {isBlunder ? 'Blunder · –2.4' : `${evalVal > 0 ? '+' : ''}${evalVal.toFixed(1)}`}
            </Pill>
          </View>
        </View>

        {/* Eval graph */}
        <Card tight>
          <View style={styles.graphLabels}>
            <Text style={[styles.graphLabel, { color: colors.inkMute }]}>+5</Text>
            <Text style={[styles.graphLabel, { color: colors.inkSoft }]}>eval · 16 moves</Text>
            <Text style={[styles.graphLabel, { color: colors.inkMute }]}>–5</Text>
          </View>
          <Sparkline data={EVAL_DATA} color={colors.ink} fill={colors.brand} height={68} />
          <Slider
            style={{ width: '100%', height: 28, marginTop: 4 }}
            minimumValue={0}
            maximumValue={EVAL_DATA.length - 1}
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

        {/* Pattern callout */}
        <Card variant="brand" tight>
          <Text style={[styles.kicker, { color: colors.brand }]}>Pattern</Text>
          <Text style={[styles.patternText, { color: colors.brand2 }]}>
            Move 8 · <Text style={{ fontWeight: '700' }}>Nd6??</Text> — hung the knight. Same shape as 3 other games this week.{' '}
            <Text style={{ fontWeight: '600', textDecorationLine: 'underline' }}>Drill it ›</Text>
          </Text>
        </Card>

        <View style={{ flex: 1 }} />

        <View style={styles.btnRow}>
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.btnText, { color: colors.ink }]}>‹ key</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.brand }]}>
            <Text style={[styles.btnText, { color: colors.onBrand }]}>What if?</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
  btnRow: { flexDirection: 'row', gap: 10 },
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
  midline: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 1,
  },
});
