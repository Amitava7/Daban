import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../navigation/types';
import { StatChip } from '../components/StatChip';
import { NavRow } from '../components/NavRow';
import { Board } from '../components/Board';
import { Pill } from '../components/Pill';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const RESUME_POS = {
  wK: { sq: 'g1', code: 'wK' }, wRa: { sq: 'a1', code: 'wR' }, wRf: { sq: 'f1', code: 'wR' },
  wQ: { sq: 'd1', code: 'wQ' }, wBc: { sq: 'c4', code: 'wB' }, wNf: { sq: 'f3', code: 'wN' },
  wPa: { sq: 'a2', code: 'wP' }, wPb: { sq: 'b2', code: 'wP' }, wPc: { sq: 'c2', code: 'wP' },
  wPd: { sq: 'd3', code: 'wP' }, wPe: { sq: 'e4', code: 'wP' }, wPf: { sq: 'f2', code: 'wP' },
  wPg: { sq: 'g2', code: 'wP' }, wPh: { sq: 'h2', code: 'wP' },
  bK: { sq: 'g8', code: 'bK' }, bRa: { sq: 'a8', code: 'bR' }, bRf: { sq: 'f8', code: 'bR' },
  bQ: { sq: 'd8', code: 'bQ' }, bBc: { sq: 'c5', code: 'bB' },
  bNc: { sq: 'c6', code: 'bN' }, bNf: { sq: 'f6', code: 'bN' },
  bPa: { sq: 'a7', code: 'bP' }, bPb: { sq: 'b7', code: 'bP' }, bPc: { sq: 'c7', code: 'bP' },
  bPd: { sq: 'd7', code: 'bP' }, bPe: { sq: 'e5', code: 'bP' },
  bPf: { sq: 'f7', code: 'bP' }, bPg: { sq: 'g7', code: 'bP' }, bPh: { sq: 'h7', code: 'bP' },
};

export function HomeScreen() {
  const { colors } = useTheme();
  const nav = useNavigation<Nav>();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header row */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.kicker, { color: colors.inkMute }]}>Tuesday · day 12 of practice</Text>
            <Text style={[styles.greeting, { color: colors.ink }]}>
              Welcome back,{' '}
              <Text style={[styles.greetingName, { color: colors.brand, fontStyle: 'italic' }]}>Sam</Text>
            </Text>
          </View>
          <TouchableOpacity onPress={() => nav.navigate('Settings')}>
            <Text style={[styles.settingsIcon, { color: colors.ink2 }]}>⚙</Text>
          </TouchableOpacity>
        </View>

        {/* Stat chips */}
        <View style={styles.statsRow}>
          <StatChip label="ELO" value="1280" delta="+24" />
          <StatChip label="Streak" value="3" suffix="🔥" />
          <StatChip label="Accuracy" value="78%" />
        </View>

        {/* Resume hero */}
        <TouchableOpacity
          style={[styles.resumeCard, { backgroundColor: colors.brandSoft, borderColor: colors.brandTint }]}
          onPress={() => nav.navigate('Game')}
          activeOpacity={0.8}
        >
          <View style={styles.resumeBoard}>
            <Board pieces={RESUME_POS} size={96} />
          </View>
          <View style={styles.resumeInfo}>
            <Text style={[styles.kicker, { color: colors.brand }]}>Resume game</Text>
            <Text style={[styles.resumeTitle, { color: colors.brand2, fontFamily: 'serif', fontStyle: 'italic' }]}>
              Move 14 · you're +0.3
            </Text>
            <Text style={[styles.resumeMeta, { color: colors.brand2 }]}>vs Coach Lv 4 · started 2h ago</Text>
          </View>
          <View style={[styles.resumeBtn, { backgroundColor: colors.brand }]}>
            <Text style={[styles.resumeBtnText, { color: colors.onBrand }]}>▶</Text>
          </View>
        </TouchableOpacity>

        {/* Nav rows */}
        <View style={styles.navList}>
          <NavRow glyph="♟" title="New game" meta="Level 4 · ≈ 1100 ELO" onPress={() => nav.navigate('Game')} />
          <NavRow glyph="♝" title="Openings" meta="Italian Game · 62% mastered" tone="brand" onPress={() => nav.navigate('Openings')} />
          <NavRow glyph="♚" title="Endgames" meta="K + P vs K next up" onPress={() => nav.navigate('Endgames')} />
          <NavRow glyph="↗" title="Progress" meta="+24 ELO this week" tone="good" onPress={() => nav.navigate('Progress')} />
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderWidth: 1,
    borderRadius: 18,
  },
  resumeBoard: { width: 96, flexShrink: 0 },
  resumeInfo: { flex: 1 },
  resumeTitle: { fontSize: 19, fontWeight: '500', lineHeight: 22, marginTop: 4 },
  resumeMeta: { fontSize: 12, opacity: 0.75, marginTop: 2 },
  resumeBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeBtnText: { fontSize: 16 },
  navList: { gap: 10 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 4 },
  footerText: { fontSize: 12 },
});
