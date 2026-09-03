import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useGame } from '../context/GameContext';
import { AppBar } from '../components/AppBar';
import { Board } from '../components/Board';
import { Card } from '../components/Card';
import { Chess } from 'chess.js';
import { refutationLine } from '../engine/engine';
import { fenToPieces } from '../utils/fenUtils';
import { PieceData } from '../components/Board';

interface Frame {
  title: string;
  caption: string;
  fen: string;
  highlightFrom?: string;
  highlightTo?: string;
}

async function buildRefutationFrames(
  positionBeforeBlunder: string,
  blunderSan: string,
): Promise<Frame[]> {
  const frames: Frame[] = [];
  const chess = new Chess(positionBeforeBlunder);

  // Frame 1: position before blunder
  frames.push({
    title: 'Your move',
    caption: `You played ${blunderSan}. This leaves a weakness that can be exploited.`,
    fen: chess.fen(),
  });

  // Make the blunder
  let blunder;
  try {
    blunder = chess.move(blunderSan);
  } catch {
    return frames;
  }
  frames.push({
    title: `1. …${blunderSan}`,
    caption: `After ${blunderSan}, the opponent has a strong response.`,
    fen: chess.fen(),
    highlightFrom: blunder.from,
    highlightTo: blunder.to,
  });

  // The engine's best line for BOTH sides from the position after the blunder
  // (one search — no random replies, no overlapping searches).
  const line = await refutationLine(chess.fen(), 6, 1200);
  line.forEach((m, i) => {
    const opponentMove = i % 2 === 0; // the first reply punishes the blunder
    frames.push({
      title: `${i + 2}. ${m.san}`,
      caption: opponentMove ? punishCaption(m.san, i) : defenseCaption(m.san),
      fen: m.fen,
      highlightFrom: m.from,
      highlightTo: m.to,
    });
  });

  return frames;
}

function punishCaption(san: string, idx: number): string {
  if (san.includes('#')) return 'Checkmate — the position collapses.';
  if (san.includes('x')) return 'Wins material — punishing the weakness.';
  if (san.startsWith('O-O')) return 'Castles in, with pressure mounting.';
  if (san.includes('+')) return 'Check — seizing the initiative.';
  if (idx === 0) return 'The strongest response — exploiting the weakness.';
  return 'Building on the advantage.';
}

function defenseCaption(san: string): string {
  if (san.includes('x')) return 'Forced to trade, but the damage is done.';
  return 'The best defence — yet the position stays difficult.';
}

export function RefutationScreen() {
  const { colors } = useTheme();
  const nav = useNavigation();
  const { moveHistory, playerColor } = useGame();
  const [step, setStep] = useState(0);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [auto, setAuto] = useState(true);

  // Find the last blunder/mistake in history
  const blunderRecord = useMemo(() => {
    return [...moveHistory].reverse().find(m =>
      m.playerMove && (m.analysis?.quality === 'blunder' || m.analysis?.quality === 'mistake')
    );
  }, [moveHistory]);

  useEffect(() => {
    if (!blunderRecord) return;
    let cancelled = false;
    // Find the FEN before the blunder
    const idx = moveHistory.indexOf(blunderRecord);
    const fenBefore = idx > 0 ? moveHistory[idx - 1].fen : 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    (async () => {
      const built = await buildRefutationFrames(fenBefore, blunderRecord.san);
      if (cancelled) return;
      setFrames(built);
      setStep(0);
    })();
    return () => { cancelled = true; };
  }, [blunderRecord]);

  useEffect(() => {
    if (!auto || frames.length === 0) return;
    const timer = setInterval(() => {
      setStep(s => {
        if (s + 1 >= frames.length) { setAuto(false); return s; }
        return s + 1;
      });
    }, 2200);
    return () => clearInterval(timer);
  }, [auto, frames.length]);

  const f = frames[step];
  const pieces = f ? fenToPieces(f.fen) : {};
  const highlights = f
    ? [
        f.highlightFrom && { sq: f.highlightFrom, kind: 'bad' as const },
        f.highlightTo && { sq: f.highlightTo, kind: 'bad' as const },
      ].filter(Boolean) as any[]
    : [];

  if (!f) {
    // While a blunder exists we're computing its refutation — show a spinner
    // rather than flashing the "nothing to refute" message.
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <AppBar left="✕" title="What you missed" onLeft={() => nav.goBack()} />
        <View style={[styles.body, { alignItems: 'center', justifyContent: 'center', gap: 12 }]}>
          {blunderRecord ? (
            <>
              <ActivityIndicator color={colors.brand} />
              <Text style={{ color: colors.inkMute }}>Analysing the refutation…</Text>
            </>
          ) : (
            <Text style={{ color: colors.inkMute }}>No blunder to refute yet.</Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <AppBar
        left="✕"
        title="What you missed"
        sub={`Step ${step + 1} of ${frames.length}`}
        right="↻"
        onLeft={() => nav.goBack()}
        onRight={() => { setStep(0); setAuto(true); }}
      />

      <View style={styles.body}>
        <View>
          <Board
            pieces={pieces}
            highlights={highlights}
            flipped={playerColor === 'b'}
            coords
          />
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
          <TouchableOpacity
            style={styles.playBtn}
            onPress={() => { setAuto(false); setStep(s => Math.max(0, s - 1)); }}
          >
            <Text style={[styles.playBtnText, { color: colors.ink2 }]}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.playBtnPrimary, { backgroundColor: colors.brand }]}
            onPress={() => { setStep(0); setAuto(true); }}
          >
            <Text style={[styles.playBtnText, { color: colors.onBrand }]}>▶ replay</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.playBtn}
            onPress={() => { setAuto(false); setStep(s => Math.min(frames.length - 1, s + 1)); }}
          >
            <Text style={[styles.playBtnText, { color: colors.ink2 }]}>›</Text>
          </TouchableOpacity>
          <View style={[styles.scrub, { backgroundColor: colors.surface3 }]}>
            <View style={[styles.scrubFill, {
              width: `${((step + 1) / frames.length) * 100}%` as any,
              backgroundColor: colors.brand,
            }]} />
          </View>
        </View>

        <View style={{ flex: 1 }} />

        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => nav.goBack()}
          >
            <Text style={[styles.btnText, { color: colors.ink }]}>Got it</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.brand }]}
            onPress={() => { nav.navigate('Game' as never); }}
          >
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
    position: 'absolute', top: 12, left: 12, borderWidth: 1, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 4,
  },
  titleBadgeText: { fontSize: 12, fontWeight: '600' },
  kicker: { fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 },
  caption: { fontSize: 17, lineHeight: 24, letterSpacing: -0.2, minHeight: 48 },
  playRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, padding: 4,
  },
  playBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  playBtnPrimary: {
    height: 36, paddingHorizontal: 16, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
  },
  playBtnText: { fontSize: 14, fontWeight: '600' },
  scrub: { flex: 1, height: 4, borderRadius: 999, marginHorizontal: 8, overflow: 'hidden' },
  scrubFill: { position: 'absolute', top: 0, left: 0, bottom: 0, borderRadius: 999 },
  btnRow: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 12, borderWidth: 1, minHeight: 44,
  },
  btnText: { fontSize: 14, fontWeight: '600' },
});
