import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../context/ThemeContext';
import { useGame } from '../context/GameContext';
import { useProgress } from '../context/ProgressContext';
import { RootStackParamList } from '../navigation/types';
import { eloToLevel } from '../engine/rating';
import { isPlayablePosition } from '../lessons/LessonEngine';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ColorPicker'>;
type Route = RouteProp<RootStackParamList, 'ColorPicker'>;

function sideToMove(fen: string): 'w' | 'b' {
  return fen.split(' ')[1] === 'b' ? 'b' : 'w';
}

const TIME_OPTIONS: { label: string; value: 'none' | '5min' | '10min'; sub: string }[] = [
  { label: 'No clock', value: 'none', sub: 'Unlimited time' },
  { label: '5 min', value: '5min', sub: '5+0 blitz' },
  { label: '10 min', value: '10min', sub: '10+0 rapid' },
];

export function ColorPickerScreen() {
  const { colors } = useTheme();
  const nav = useNavigation<Nav>();
  const { startNewGame } = useGame();
  const { settings, progress } = useProgress();
  const params = useRoute<Route>().params;

  // A caller (a lesson step, say) can hand us a position to play out. Anything
  // unplayable — an illegal FEN, or a finished position — falls back to a
  // normal game from the initial array.
  const startFen = params?.fen && isPlayablePosition(params.fen) ? params.fen : undefined;
  const fromLabel = startFen ? params?.fromLabel : undefined;

  // Defaulting to the side to move is what you want nine times out of ten:
  // you tapped "play here" because it is your turn in the lesson.
  const [color, setColor] = useState<'w' | 'b' | 'random'>(
    startFen ? sideToMove(startFen) : 'w'
  );
  const [timeControl, setTimeControl] = useState<'none' | '5min' | '10min'>(
    settings.timeControl ?? '10min'
  );

  // The coach plays at the same strength as the player: map the player's
  // current Elo to the nearest engine level.
  const coachLevel = eloToLevel(progress.elo);

  const launch = () => {
    const chosen = color === 'random'
      ? (Math.random() < 0.5 ? 'w' : 'b')
      : color;
    startNewGame(chosen, coachLevel, timeControl, startFen);
    nav.navigate('Game');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <View style={styles.body}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => nav.goBack()}>
          <Text style={[styles.closeText, { color: colors.inkMute }]}>✕</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.ink, fontFamily: 'serif' }]}>
          {startFen ? 'Play from here' : 'New game'}
        </Text>
        <Text style={[styles.sub, { color: colors.inkSoft }]}>
          vs Coach · matches your {progress.elo} ELO
        </Text>

        {startFen && (
          <View style={[styles.fromCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.fromLabel, { color: colors.inkMute }]}>FROM THE POSITION ON THE BOARD</Text>
            {!!fromLabel && (
              <Text style={[styles.fromTitle, { color: colors.ink }]} numberOfLines={2}>
                {fromLabel}
              </Text>
            )}
            <Text style={[styles.fromFen, { color: colors.inkSoft }]} numberOfLines={1}>
              {startFen}
            </Text>
          </View>
        )}

        {/* Color choice */}
        <Text style={[styles.sectionLabel, { color: colors.inkMute }]}>PLAY AS</Text>
        <View style={styles.colorRow}>
          {(['w', 'random', 'b'] as const).map(c => (
            <TouchableOpacity
              key={c}
              onPress={() => setColor(c)}
              style={[
                styles.colorBtn,
                {
                  backgroundColor: color === c ? colors.brand : colors.surface,
                  borderColor: color === c ? colors.brand : colors.border,
                },
              ]}
            >
              <Text style={styles.colorGlyph}>
                {c === 'w' ? '♔' : c === 'b' ? '♚' : '⬡'}
              </Text>
              <Text style={[styles.colorLabel, { color: color === c ? colors.onBrand : colors.ink }]}>
                {c === 'w' ? 'White' : c === 'b' ? 'Black' : 'Random'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Time control */}
        <Text style={[styles.sectionLabel, { color: colors.inkMute }]}>TIME CONTROL</Text>
        <View style={styles.timeRow}>
          {TIME_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => setTimeControl(opt.value)}
              style={[
                styles.timeBtn,
                {
                  backgroundColor: timeControl === opt.value ? colors.brandSoft : colors.surface,
                  borderColor: timeControl === opt.value ? colors.brand : colors.border,
                },
              ]}
            >
              <Text style={[styles.timeLabel, { color: timeControl === opt.value ? colors.brand2 : colors.ink }]}>
                {opt.label}
              </Text>
              <Text style={[styles.timeSub, { color: timeControl === opt.value ? colors.brand2 : colors.inkMute }]}>
                {opt.sub}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ flex: 1 }} />

        <TouchableOpacity
          style={[styles.startBtn, { backgroundColor: colors.brand }]}
          onPress={launch}
        >
          <Text style={[styles.startText, { color: colors.onBrand }]}>Play ▶</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12, gap: 16 },
  closeBtn: { alignSelf: 'flex-end', padding: 8 },
  closeText: { fontSize: 20 },
  title: { fontSize: 34, fontWeight: '500', letterSpacing: -0.5, marginTop: 8 },
  sub: { fontSize: 14, marginTop: -8 },
  sectionLabel: {
    fontSize: 10,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: -6,
    marginTop: 4,
  },
  fromCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 5 },
  fromLabel: {
    fontSize: 10,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  fromTitle: { fontSize: 15, fontWeight: '600' },
  fromFen: { fontSize: 11, fontFamily: 'monospace' },
  colorRow: { flexDirection: 'row', gap: 12 },
  colorBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 6,
  },
  colorGlyph: { fontSize: 32 },
  colorLabel: { fontSize: 13, fontWeight: '600' },
  timeRow: { flexDirection: 'row', gap: 10 },
  timeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 4,
  },
  timeLabel: { fontSize: 15, fontWeight: '600' },
  timeSub: { fontSize: 11 },
  startBtn: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startText: { fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },
});
