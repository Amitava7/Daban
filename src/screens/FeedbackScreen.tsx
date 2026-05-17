import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../context/ThemeContext';
import { useGame } from '../context/GameContext';
import { RootStackParamList } from '../navigation/types';
import { AppBar } from '../components/AppBar';
import { Board } from '../components/Board';
import { EvalBar } from '../components/EvalBar';
import { Pill } from '../components/Pill';
import { Card } from '../components/Card';
import {
  formatEval, qualityLabel, qualityTone, MoveQuality,
} from '../engine/MoveClassifier';
import { fenToPieces } from '../utils/fenUtils';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Feedback'>;

function evalBarPct(cp: number): number {
  const clamped = Math.max(-1000, Math.min(1000, cp));
  return 10 + ((clamped + 1000) / 2000) * 80;
}

export function FeedbackScreen() {
  const { colors } = useTheme();
  const nav = useNavigation<Nav>();
  const { fen, lastAnalysis, moveHistory, playerColor, level, clearBlunderAlert } = useGame();

  const analysis = lastAnalysis;
  const lastPlayerMove = [...moveHistory].reverse().find(m => m.playerMove);
  const pieces = fenToPieces(fen);

  if (!analysis || !lastPlayerMove) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <AppBar left="‹" title="Feedback" onLeft={() => nav.goBack()} />
        <View style={[styles.body, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: colors.inkMute }}>Play a move to see feedback.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const quality = analysis.quality;
  const tone = qualityTone(quality);
  const evalAfter = formatEval(analysis.evalAfter);
  const cpLoss = analysis.centipawnLoss;
  const evalPct = evalBarPct(analysis.evalAfter);

  const isNegative = quality === 'blunder' || quality === 'mistake' || quality === 'inaccuracy';
  const evalSign = cpLoss > 0 ? `–${(cpLoss / 100).toFixed(1)}` : `+${(-cpLoss / 100).toFixed(1)}`;

  const highlights = lastPlayerMove.san
    ? [{ sq: lastPlayerMove.san.slice(-2), kind: tone === 'bad' ? 'bad' as const : tone === 'warn' ? 'warn' as const : 'good' as const }].filter(h => /^[a-h][1-8]$/.test(h.sq))
    : [];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <AppBar
        left="‹"
        title="vs Coach"
        sub={`Level ${level}`}
        onLeft={() => nav.goBack()}
      />

      <View style={styles.body}>
        {/* Toast */}
        <View style={[styles.toast, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pill tone={`${tone}-soft` as any}>{qualityLabel(quality)}</Pill>
          <Text style={[styles.toastMove, { color: colors.ink, fontFamily: 'monospace' }]}>
            {cpLoss > 0 ? `–${(cpLoss / 100).toFixed(1)}` : '±0'} · {lastPlayerMove.san}
          </Text>
          <View style={{ flex: 1 }} />
          <Text style={[styles.toastHint, { color: colors.inkMute }]}>
            {formatEval(analysis.evalAfter)}
          </Text>
        </View>

        {/* Board */}
        <View style={styles.boardRow}>
          <EvalBar pct={evalPct} label={formatEval(analysis.evalAfter)} />
          <View style={{ flex: 1 }}>
            <Board
              pieces={pieces}
              highlights={highlights}
              flipped={playerColor === 'b'}
            />
          </View>
        </View>

        {/* Analysis card */}
        <Card variant={tone} loose>
          <View style={styles.header}>
            <Pill tone={tone as any}>{qualityLabel(quality)}</Pill>
            <Text style={[styles.meta, { color: tone === 'good' ? colors.good2 : tone === 'bad' ? colors.bad2 : colors.warn, fontFamily: 'monospace' }]}>
              {cpLoss > 10 ? `–${(cpLoss / 100).toFixed(1)} pawns` : 'best play'}
            </Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={() => nav.goBack()}>
              <Text style={[styles.dismiss, { color: colors.inkMute }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.explanationTitle, {
            color: tone === 'good' ? colors.good2 : tone === 'bad' ? colors.bad2 : colors.warn,
            fontFamily: 'serif',
          }]}>
            {analysis.explanation}
          </Text>

          <Text style={[styles.coachComment, {
            color: tone === 'good' ? colors.good2 : tone === 'bad' ? colors.bad2 : colors.warn,
          }]}>
            {analysis.coachComment}
          </Text>

          {isNegative && (
            <View style={styles.blunderBtns}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: tone === 'bad' ? colors.bad : tone === 'warn' ? colors.warn : colors.brand, borderColor: 'transparent' }]}
                onPress={() => nav.navigate('Refutation')}
              >
                <Text style={[styles.btnText, { color: '#fff' }]}>Show refutation</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => { clearBlunderAlert(); nav.goBack(); }}
              >
                <Text style={[styles.btnText, { color: colors.ink }]}>Continue</Text>
              </TouchableOpacity>
            </View>
          )}
        </Card>

        <View style={{ flex: 1 }} />

        {!isNegative && (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.ink }]}
            onPress={() => { clearBlunderAlert(); nav.goBack(); }}
          >
            <Text style={[styles.btnText, { color: colors.surface }]}>Continue ›</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 18, paddingBottom: 18, gap: 14 },
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 10, paddingHorizontal: 12, borderWidth: 1, borderRadius: 12,
  },
  toastMove: { fontSize: 12.5 },
  toastHint: { fontSize: 12 },
  boardRow: { flexDirection: 'row', gap: 8 },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 8 },
  meta: { fontSize: 12 },
  dismiss: { fontSize: 16 },
  explanationTitle: { fontSize: 18, fontWeight: '500', lineHeight: 23, letterSpacing: -0.2 },
  coachComment: { fontSize: 13, lineHeight: 20, marginTop: 6, opacity: 0.85 },
  blunderBtns: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, borderRadius: 10, borderWidth: 1, minHeight: 36,
  },
  btnText: { fontSize: 13, fontWeight: '600' },
  primaryBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 12, minHeight: 44,
  },
});
