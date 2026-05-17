import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../context/ThemeContext';
import { useProgress } from '../context/ProgressContext';
import { RootStackParamList } from '../navigation/types';
import { AppBar } from '../components/AppBar';
import { Pill } from '../components/Pill';
import { Card } from '../components/Card';
import { Sparkline } from '../components/Sparkline';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Progress'>;

function MiniStat({ label, value, delta, tone }: { label: string; value: string; delta?: string; tone?: 'good' | 'bad' }) {
  const { colors } = useTheme();
  return (
    <Card tight style={{ flex: 1, padding: 10 }}>
      <Text style={[styles.miniLabel, { color: colors.inkMute }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
        <Text style={[styles.miniValue, { color: colors.ink, fontFamily: 'serif' }]}>{value}</Text>
        {delta && (
          <Text style={[styles.miniDelta, { color: tone === 'good' ? colors.good : colors.bad, fontFamily: 'monospace' }]}>
            {delta}
          </Text>
        )}
      </View>
    </Card>
  );
}

function Insight({ tone, title, stat, body, cta }: {
  tone: 'good' | 'bad' | 'warn'; title: string; stat: string; body: string; cta: string;
}) {
  const { colors } = useTheme();
  const colorMap: Record<string, string> = { good: colors.good2, bad: colors.bad2, warn: colors.warn };
  const c = colorMap[tone] ?? colors.ink;
  return (
    <Card variant={tone} style={{ gap: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <Text style={[styles.insightTitle, { color: c, fontFamily: 'serif' }]}>{title}</Text>
        <Text style={[styles.insightStat, { color: c, fontFamily: 'monospace' }]}>{stat}</Text>
      </View>
      <Text style={[styles.insightBody, { color: c }]}>{body}</Text>
      <Text style={[styles.insightCta, { color: c }]}>{cta} <Text>›</Text></Text>
    </Card>
  );
}

export function ProgressScreen() {
  const { colors } = useTheme();
  const nav = useNavigation<Nav>();
  const { progress, weeklyEloChange, weeklyAccuracy, totalGames, avgBlundersPerGame } = useProgress();

  // Build ELO sparkline from last 8 game records
  const eloData = useMemo(() => {
    const base = progress.elo;
    if (progress.games.length === 0) return [base];
    const recent = [...progress.games].reverse().slice(0, 8);
    const dataPoints: number[] = [];
    let running = base;
    for (let i = recent.length - 1; i >= 0; i--) {
      running -= recent[i].eloChange; // go backwards
    }
    dataPoints.push(running);
    for (const g of recent) {
      running += g.eloChange;
      dataPoints.push(running);
    }
    return dataPoints;
  }, [progress]);

  const wEloChange = weeklyEloChange();
  const wAccuracy = weeklyAccuracy();
  const games = totalGames();
  const blunders = avgBlundersPerGame();

  // Generate insights based on real data
  const insights = useMemo(() => {
    const result: Array<{ tone: 'good'|'bad'|'warn'; title: string; stat: string; body: string; cta: string }> = [];

    if (games === 0) {
      result.push({
        tone: 'warn',
        title: 'No games yet',
        stat: '0',
        body: 'Start playing to see your performance insights.',
        cta: 'Play now',
      });
      return result;
    }

    // Blunder insight
    if (blunders > 1.5) {
      result.push({
        tone: 'bad',
        title: 'Blunders per game',
        stat: blunders.toFixed(1),
        body: `You're averaging ${blunders.toFixed(1)} blunders per game. Focus on checking your moves before playing.`,
        cta: 'Drill puzzles',
      });
    } else if (blunders <= 0.5) {
      result.push({
        tone: 'good',
        title: 'Clean play',
        stat: blunders.toFixed(1),
        body: `Impressive — only ${blunders.toFixed(1)} blunders per game on average. Your calculation is improving.`,
        cta: 'See games',
      });
    }

    // ELO trend
    if (wEloChange >= 10) {
      result.push({
        tone: 'good',
        title: 'Rating climbing',
        stat: `+${wEloChange}`,
        body: `You've gained ${wEloChange} rating points this week. Keep up the consistent play.`,
        cta: 'Keep going',
      });
    } else if (wEloChange <= -15) {
      result.push({
        tone: 'warn',
        title: 'Rating dipping',
        stat: `${wEloChange}`,
        body: 'Your rating dropped this week. Try reducing time pressure or dropping one difficulty level.',
        cta: 'Adjust settings',
      });
    }

    // Accuracy
    if (wAccuracy > 0) {
      if (wAccuracy >= 75) {
        result.push({
          tone: 'good',
          title: 'High accuracy',
          stat: `${wAccuracy}%`,
          body: `${wAccuracy}% average accuracy this week. You're finding strong moves consistently.`,
          cta: 'See games',
        });
      } else if (wAccuracy < 60) {
        result.push({
          tone: 'bad',
          title: 'Accuracy needs work',
          stat: `${wAccuracy}%`,
          body: `${wAccuracy}% accuracy — many moves are below engine quality. Slow down and check tactics.`,
          cta: 'Drill tactics',
        });
      }
    }

    if (result.length === 0) {
      result.push({
        tone: 'warn',
        title: 'Keep playing',
        stat: `${games} games`,
        body: 'Play more games to unlock detailed pattern insights.',
        cta: 'Start a game',
      });
    }

    return result;
  }, [blunders, wEloChange, wAccuracy, games]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <AppBar left="‹" title="Progress" right="filter" onLeft={() => nav.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ELO hero */}
        <View style={styles.hero}>
          <View>
            <Text style={[styles.kicker, { color: colors.inkMute }]}>ELO · all-time</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
              <Text style={[styles.eloValue, { color: colors.ink, fontFamily: 'serif' }]}>
                {progress.elo}
              </Text>
              <Pill tone={wEloChange >= 0 ? 'good-soft' : 'bad-soft'}>
                {wEloChange >= 0 ? '+' : ''}{wEloChange} wk
              </Pill>
            </View>
          </View>
          <View style={{ width: 130 }}>
            <Sparkline data={eloData} color={colors.brand} fill={colors.brand} height={48} />
          </View>
        </View>

        {/* Mini stats */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <MiniStat
            label="Accuracy"
            value={wAccuracy > 0 ? `${wAccuracy}%` : '—'}
            delta={wAccuracy > 0 ? undefined : undefined}
            tone="good"
          />
          <MiniStat label="Games" value={games.toString()} />
          <MiniStat
            label="Blund/g"
            value={games > 0 ? blunders.toFixed(1) : '—'}
            tone={blunders > 1.5 ? 'bad' : 'good'}
          />
        </View>

        <Text style={[styles.kicker, { color: colors.inkMute, marginTop: 4 }]}>Insights · this week</Text>

        {insights.map((ins, i) => (
          <Insight key={i} {...ins} />
        ))}

        {/* Game history */}
        {progress.games.length > 0 && (
          <>
            <Text style={[styles.kicker, { color: colors.inkMute, marginTop: 4 }]}>Recent games</Text>
            {progress.games.slice(0, 5).map((g, i) => (
              <View
                key={i}
                style={[styles.gameRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={[styles.gameResult, {
                  backgroundColor: g.result === 'win' ? colors.good : g.result === 'loss' ? colors.bad : colors.warn,
                }]}>
                  <Text style={styles.gameResultText}>
                    {g.result === 'win' ? 'W' : g.result === 'loss' ? 'L' : 'D'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.gameMeta, { color: colors.ink }]}>
                    {g.playerColor === 'w' ? 'White' : 'Black'} · Lv {g.level}
                  </Text>
                  <Text style={[styles.gameSub, { color: colors.inkMute }]}>
                    {g.moves} moves · {g.accuracy}% acc · {g.blunders} blunders
                  </Text>
                </View>
                <Text style={[styles.gameElo, {
                  color: g.eloChange >= 0 ? colors.good : colors.bad,
                  fontFamily: 'monospace',
                }]}>
                  {g.eloChange >= 0 ? '+' : ''}{g.eloChange}
                </Text>
              </View>
            ))}
          </>
        )}

        <TouchableOpacity style={styles.ghostBtn}>
          <Text style={[styles.ghostBtnText, { color: colors.ink2 }]}>View raw stats ›</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 18, gap: 14 },
  kicker: { fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 1.2 },
  hero: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14 },
  eloValue: { fontSize: 44, fontWeight: '500', lineHeight: 46 },
  miniLabel: { fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 1 },
  miniValue: { fontSize: 20, fontWeight: '500', lineHeight: 22 },
  miniDelta: { fontSize: 11, fontWeight: '600' },
  insightTitle: { flex: 1, fontSize: 19, fontWeight: '500', letterSpacing: -0.2, lineHeight: 24 },
  insightStat: { fontSize: 13, fontWeight: '600', flexShrink: 0 },
  insightBody: { fontSize: 13, lineHeight: 19, marginTop: 6, opacity: 0.85 },
  insightCta: { fontSize: 13, fontWeight: '600', marginTop: 12 },
  gameRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 10, paddingHorizontal: 12, borderWidth: 1, borderRadius: 10,
  },
  gameResult: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  gameResultText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  gameMeta: { fontSize: 13, fontWeight: '600' },
  gameSub: { fontSize: 11, marginTop: 2 },
  gameElo: { fontSize: 13, fontWeight: '600' },
  ghostBtn: { alignItems: 'center', paddingVertical: 8 },
  ghostBtnText: { fontSize: 13, fontWeight: '600' },
});
