import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { AppBar } from '../components/AppBar';
import { Pill } from '../components/Pill';
import { Card } from '../components/Card';
import { Sparkline } from '../components/Sparkline';

const ELO_DATA = [1240, 1245, 1238, 1252, 1260, 1270, 1268, 1280];

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
  const colorMap = { good: colors.good2, bad: colors.bad2, warn: colors.warn };
  const c = colorMap[tone];

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
  const nav = useNavigation();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <AppBar left="‹" title="Progress" right="filter" onLeft={() => nav.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ELO hero */}
        <View style={styles.hero}>
          <View>
            <Text style={[styles.kicker, { color: colors.inkMute }]}>ELO · all-time</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
              <Text style={[styles.eloValue, { color: colors.ink, fontFamily: 'serif' }]}>1280</Text>
              <Pill tone="good-soft">+24 wk</Pill>
            </View>
          </View>
          <View style={{ width: 130 }}>
            <Sparkline data={ELO_DATA} color={colors.brand} fill={colors.brand} height={48} />
          </View>
        </View>

        {/* Mini stats */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <MiniStat label="Accuracy" value="78%" delta="+6" tone="good" />
          <MiniStat label="Games" value="14" />
          <MiniStat label="Blund/g" value="1.2" delta="–0.4" tone="good" />
        </View>

        <Text style={[styles.kicker, { color: colors.inkMute, marginTop: 4 }]}>Insights · this week</Text>

        <Insight
          tone="bad"
          title="Knights left hanging"
          stat="40%"
          body="In 4 of last 10 games you moved a knight to a square only defended by a pinned piece."
          cta="Drill 5 puzzles"
        />
        <Insight
          tone="good"
          title="Endgame conversion up"
          stat="+18%"
          body="K + P drills are paying off — you converted 6 / 7 winning endgames this week."
          cta="See games"
        />
        <Insight
          tone="warn"
          title="Time pressure hurts you"
          stat="–12 pts"
          body="Accuracy drops sharply in the last 5 minutes of long games."
          cta="Adjust timer"
        />

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
  ghostBtn: { alignItems: 'center', paddingVertical: 8 },
  ghostBtnText: { fontSize: 13, fontWeight: '600' },
});
