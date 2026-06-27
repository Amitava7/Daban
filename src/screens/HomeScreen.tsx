import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useGame } from '../context/GameContext';
import { useProgress } from '../context/ProgressContext';
import { RootStackParamList } from '../navigation/types';
import { StatChip } from '../components/StatChip';
import { NavRow } from '../components/NavRow';
import { Board } from '../components/Board';
import { Pill } from '../components/Pill';
import { fenToPieces } from '../utils/fenUtils';
import { Storage } from '../services/StorageService';
import { OPENINGS } from '../engine/OpeningBook';
import { CATEGORY_META, getAllPuzzles } from '../engine/EndgameGenerator';
import { eloToLevel } from '../engine/rating';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function getDayStreak(games: { date: string }[]): number {
  if (games.length === 0) return 0;
  let streak = 0;
  let currentDay = new Date();
  currentDay.setHours(0, 0, 0, 0);
  const sortedDays = [...new Set(games.map(g => {
    const d = new Date(g.date);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }))].sort((a, b) => b - a);

  for (const day of sortedDays) {
    const diff = (currentDay.getTime() - day) / (24 * 60 * 60 * 1000);
    if (diff <= 1) { streak++; currentDay = new Date(day); }
    else break;
  }
  return streak;
}

export function HomeScreen() {
  const { colors } = useTheme();
  const nav = useNavigation<Nav>();
  const { fen, status, playerColor, level } = useGame();
  const { progress, openingMastery, endgameCompleted, weeklyEloChange } = useProgress();

  const hasActiveGame = status === 'playing' || status === 'engine_thinking' || status === 'player_blundered';
  const liveFen = hasActiveGame ? fen : INITIAL_FEN;

  // The HomeScreen stays mounted while the user plays on GameScreen, so every
  // engine/player move would otherwise re-render this screen, re-run
  // fenToPieces (~32 brand-new keys), and force ~30 AnimatedPiece unmount/
  // mount pairs on the same UI thread that Reanimated is using to animate
  // the live board. We observed this churn coinciding with the live board's
  // withTiming being dropped (the "ghost piece" symptom). Freeze the
  // offscreen preview at the FEN it was last showing while focused, so
  // there's no work on the UI thread for the offscreen preview between moves.
  const isFocused = useIsFocused();
  const previewFenRef = useRef(liveFen);
  if (isFocused) previewFenRef.current = liveFen;
  const previewFen = previewFenRef.current;
  const resumePieces = useMemo(() => fenToPieces(previewFen), [previewFen]);
  const wEloChange = weeklyEloChange();
  const streak = getDayStreak(progress.games);
  const accuracy = (() => {
    const recent = progress.games.slice(0, 5);
    if (recent.length === 0) return 0;
    return Math.round(recent.reduce((s, g) => s + g.accuracy, 0) / recent.length);
  })();

  // Best opening to practice
  const bestOpeningToPractice = OPENINGS.map(o => {
    const m = openingMastery[o.id] ?? { played: 0, correct: 0 };
    const mastery = m.played > 0 ? Math.round((m.correct / m.played) * 100) : 0;
    return { ...o, mastery };
  }).sort((a, b) => a.mastery - b.mastery)[0];

  // Next endgame puzzle
  const nextEndgame = getAllPuzzles().find(p => !endgameCompleted[p.id]);

  const today = new Date();
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
  const practiceDay = progress.games.length + 1;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header row */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.kicker, { color: colors.inkMute }]}>
              {dayName} · day {practiceDay} of practice
            </Text>
            <Text style={[styles.greeting, { color: colors.ink }]}>
              Welcome back,{' '}
              <Text style={[styles.greetingName, { color: colors.brand, fontStyle: 'italic' }]}>Player</Text>
            </Text>
          </View>
          <TouchableOpacity onPress={() => nav.navigate('Settings')}>
            <Text style={[styles.settingsIcon, { color: colors.ink2 }]}>⚙</Text>
          </TouchableOpacity>
        </View>

        {/* Stat chips */}
        <View style={styles.statsRow}>
          <StatChip label="ELO" value={progress.elo.toString()} delta={wEloChange !== 0 ? `${wEloChange >= 0 ? '+' : ''}${wEloChange}` : undefined} />
          <StatChip label="Streak" value={streak.toString()} suffix="🔥" />
          <StatChip label="Accuracy" value={accuracy > 0 ? `${accuracy}%` : '—'} />
        </View>

        {/* Resume / New game hero */}
        <TouchableOpacity
          style={[styles.resumeCard, { backgroundColor: colors.brandSoft, borderColor: colors.brandTint }]}
          onPress={() => hasActiveGame ? nav.navigate('Game') : nav.navigate('ColorPicker')}
          activeOpacity={0.8}
        >
          <View style={styles.resumeBoard}>
            <Board pieces={resumePieces} size={96} flipped={playerColor === 'b'} />
          </View>
          <View style={styles.resumeInfo}>
            <Text style={[styles.kicker, { color: colors.brand }]}>
              {hasActiveGame ? 'Resume game' : 'New game'}
            </Text>
            <Text style={[styles.resumeTitle, { color: colors.brand2, fontFamily: 'serif', fontStyle: 'italic' }]}>
              {hasActiveGame
                ? `Move ${Math.floor(progress.games.length + 1)} · vs Coach Lv ${level}`
                : 'vs Coach · tap to start'}
            </Text>
            <Text style={[styles.resumeMeta, { color: colors.brand2 }]}>
              {hasActiveGame
                ? `Level ${level} · ${playerColor === 'w' ? 'White' : 'Black'}`
                : `≈ ${progress.elo} ELO · choose color`}
            </Text>
          </View>
          <View style={[styles.resumeBtn, { backgroundColor: colors.brand }]}>
            <Text style={[styles.resumeBtnText, { color: colors.onBrand }]}>▶</Text>
          </View>
        </TouchableOpacity>

        {/* Nav rows */}
        <View style={styles.navList}>
          <NavRow
            glyph="♟"
            title="New game"
            meta={`Coach matches you · Level ${eloToLevel(progress.elo)} · ≈ ${progress.elo} ELO`}
            onPress={() => nav.navigate('ColorPicker')}
          />
          <NavRow
            glyph="♝"
            title="Openings"
            meta={bestOpeningToPractice
              ? `${bestOpeningToPractice.name} · ${bestOpeningToPractice.mastery}% mastered`
              : 'Drill your openings'}
            tone="brand"
            onPress={() => nav.navigate('Openings')}
          />
          <NavRow
            glyph="♚"
            title="Endgames"
            meta={nextEndgame ? `${nextEndgame.title} next up` : 'All puzzles complete!'}
            onPress={() => nav.navigate('Endgames')}
          />
          <NavRow
            glyph="↗"
            title="Progress"
            meta={wEloChange !== 0 ? `${wEloChange >= 0 ? '+' : ''}${wEloChange} ELO this week` : `${progress.games.length} games played`}
            tone="good"
            onPress={() => nav.navigate('Progress')}
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.inkMute }]}>Help</Text>
          <Text style={[styles.footerText, { color: colors.inkMute }]}>v 1.0 · offline</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 18, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerLeft: { flex: 1 },
  kicker: { fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 1.2 },
  greeting: { fontSize: 30, fontFamily: 'serif', fontWeight: '500', letterSpacing: -0.6, marginTop: 4 },
  greetingName: {},
  settingsIcon: { fontSize: 22, padding: 4 },
  statsRow: { flexDirection: 'row', gap: 10 },
  resumeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 14, borderWidth: 1, borderRadius: 18,
  },
  resumeBoard: { width: 96, flexShrink: 0 },
  resumeInfo: { flex: 1 },
  resumeTitle: { fontSize: 19, fontWeight: '500', lineHeight: 22, marginTop: 4 },
  resumeMeta: { fontSize: 12, opacity: 0.75, marginTop: 2 },
  resumeBtn: { width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  resumeBtnText: { fontSize: 16 },
  navList: { gap: 10 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 4 },
  footerText: { fontSize: 12 },
});
