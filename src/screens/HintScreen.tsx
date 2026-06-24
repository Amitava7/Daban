import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useGame } from '../context/GameContext';
import { AppBar } from '../components/AppBar';
import { Board } from '../components/Board';
import { Card } from '../components/Card';
import { Pill } from '../components/Pill';
import { topMoves, EngineMove } from '../engine/engine';
import { formatEval } from '../engine/MoveClassifier';
import { fenToPieces } from '../utils/fenUtils';

const MAX_HINTS = 3;


function moveQualityColor(i: number, colors: any): string {
  return [colors.brand, colors.warn, colors.good][i] ?? colors.ink;
}

export function HintScreen() {
  const { colors } = useTheme();
  const nav = useNavigation();
  const { fen, playerColor, hintsUsed, makeMove } = useGame();
  const [hints, setHints] = useState<EngineMove[]>([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [activeHint, setActiveHint] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showArrows, setShowArrows] = useState(true);

  const pieces = fenToPieces(fen);
  const hintsLeft = MAX_HINTS - hintsUsed;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setVisibleCount(0);
    (async () => {
      try {
        const top = await topMoves(fen, 3);
        if (cancelled) return;
        setHints(top);
        // Stagger reveal
        top.forEach((_, i) => {
          setTimeout(() => { if (!cancelled) setVisibleCount(i + 1); }, i * 800 + 300);
        });
      } catch {}
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [fen]);

  const active = hints[activeHint];

  const highlights = showArrows && active
    ? [{ sq: active.from, kind: 'good' as const }, { sq: active.to, kind: 'good' as const }]
    : [];

  const WHY: Record<string, string> = {
    default: 'This move improves your position according to the engine.',
  };

  const moveWhy = (h: EngineMove, i: number) => {
    const eval_str = formatEval(h.score);
    if (i === 0) return `Best continuation. Eval: ${eval_str}.`;
    if (i === 1) return `Second choice. Solid but slightly less accurate. Eval: ${eval_str}.`;
    return `Alternative — slower but principled. Eval: ${eval_str}.`;
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <AppBar
        left="✕"
        title="Hint"
        sub={`${hintsLeft} hint${hintsLeft !== 1 ? 's' : ''} left`}
        right="ⓘ"
        onLeft={() => nav.goBack()}
      />

      <View style={styles.body}>
        <Board
          pieces={pieces}
          highlights={highlights}
          flipped={playerColor === 'b'}
          coords
        />

        <Card tight>
          {loading ? (
            <Text style={[styles.loading, { color: colors.inkMute }]}>Calculating...</Text>
          ) : hints.length === 0 ? (
            <Text style={[styles.loading, { color: colors.inkMute }]}>No hints available.</Text>
          ) : (
            <>
              {hints.map((h, i) => {
                const c = moveQualityColor(i, colors);
                const visible = visibleCount > i;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.legendRow, !visible && styles.dim]}
                    onPress={() => setActiveHint(i)}
                    disabled={!visible}
                  >
                    <View style={[styles.bar, { backgroundColor: c, opacity: visible ? 1 : 0 }]} />
                    <Text style={[styles.rank, { color: c, fontFamily: 'serif', fontStyle: 'italic' }]}>{i + 1}</Text>
                    <Text style={[styles.move, { color: colors.ink, fontFamily: 'serif', fontWeight: '500' }]}>{h.san}</Text>
                    <Text style={[styles.eval, { color: c, fontFamily: 'monospace' }]}>{formatEval(h.score)}</Text>
                  </TouchableOpacity>
                );
              })}

              {active && (
                <View style={[styles.whyRow, { borderTopColor: colors.divider }]}>
                  <Pill tone="outlined">
                    <Text style={{ color: moveQualityColor(activeHint, colors) }}>why {active.san}?</Text>
                  </Pill>
                  <Text style={[styles.whyText, { color: colors.ink2 }]}>
                    {moveWhy(active, activeHint)}
                  </Text>
                </View>
              )}
            </>
          )}
        </Card>

        <View style={{ flex: 1 }} />

        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setShowArrows(s => !s)}
          >
            <Text style={[styles.btnText, { color: colors.ink }]}>
              {showArrows ? 'Hide arrows' : 'Show arrows'}
            </Text>
          </TouchableOpacity>
          {active && (
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.brand }]}
              onPress={() => {
                makeMove(active.from, active.to, active.promotion);
                nav.goBack();
              }}
            >
              <Text style={[styles.btnText, { color: colors.onBrand }]}>Play {active.san}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 18, paddingBottom: 18, gap: 14 },
  loading: { textAlign: 'center', paddingVertical: 16, fontSize: 14 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  dim: { opacity: 0.32 },
  bar: { width: 28, height: 4, borderRadius: 2 },
  rank: { fontSize: 20, width: 18, lineHeight: 24 },
  move: { flex: 1, fontSize: 17, letterSpacing: -0.2 },
  eval: { fontSize: 13, fontWeight: '500' },
  whyRow: {
    borderTopWidth: 1, marginTop: 4, paddingTop: 10,
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
  },
  whyText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  btnRow: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 12, borderWidth: 1, minHeight: 44,
  },
  btnText: { fontSize: 14, fontWeight: '600' },
});
