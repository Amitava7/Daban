import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useProgress } from '../context/ProgressContext';
import { AppBar } from '../components/AppBar';
import { Pill } from '../components/Pill';

const ELO_MAP = [600, 700, 850, 1000, 1100, 1250, 1400, 1550, 1700, 1900];

const PROFILES = [
  { name: 'Quiet', sub: 'Score bar only. No interruptions.', detail: 'hints: 3/game · explain: blunders · refute: off' },
  { name: 'Balanced', sub: 'Score bar + cards for mistakes only.', detail: 'hints: 3/game · explain: mistakes + blunders · refute: ask' },
  { name: 'Loud', sub: 'Always-on coach. Hints, refutes, narrates.', detail: 'hints: ∞ · explain: all moves · refute: auto' },
  { name: 'Tournament', sub: 'No coach. Hide eval & feedback.', detail: 'for ranked / OTB prep' },
];

const TIME_OPTIONS: { label: string; value: 'none' | '5min' | '10min' }[] = [
  { label: 'No clock', value: 'none' },
  { label: '5 min', value: '5min' },
  { label: '10 min', value: '10min' },
];

function ProfileCard({ name, sub, detail, active, onPress }: {
  name: string; sub: string; detail: string; active: boolean; onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.profile,
        { backgroundColor: active ? colors.brandSoft : colors.surface, borderColor: active ? colors.brand : colors.border },
        active && { shadowColor: colors.brand, shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={{ flex: 1 }}>
        <View style={styles.profileNameRow}>
          <Text style={[styles.profileName, { color: active ? colors.brand2 : colors.ink, fontFamily: 'serif' }]}>{name}</Text>
          {active && <Pill tone="brand">active</Pill>}
        </View>
        <Text style={[styles.profileSub, { color: active ? colors.brand2 : colors.inkSoft }]}>{sub}</Text>
        <Text style={[styles.profileDetail, { color: active ? colors.brand2 : colors.inkMute, fontFamily: 'monospace' }]}>{detail}</Text>
      </View>
      <View style={[styles.radio, { borderColor: active ? colors.brand : colors.inkMute, backgroundColor: active ? colors.brand : 'transparent' }]}>
        {active && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
      </View>
    </TouchableOpacity>
  );
}

export function SettingsScreen() {
  const { colors, toggleTheme, mode } = useTheme();
  const nav = useNavigation();
  const { settings, updateSettings } = useProgress();

  const elo = ELO_MAP[Math.round(settings.level) - 1] ?? ELO_MAP[3];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <AppBar left="‹" title="Coach profile" right="?" onLeft={() => nav.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Difficulty */}
        <View style={[styles.diffBlock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.diffRow}>
            <Text style={[styles.diffLabel, { color: colors.ink }]}>Difficulty</Text>
            <Text style={[styles.diffValue, { color: colors.brand, fontFamily: 'serif' }]}>
              Lv {Math.round(settings.level)}
              <Text style={[styles.diffElo, { color: colors.inkMute, fontFamily: 'monospace' }]}>  ≈ {elo} ELO</Text>
            </Text>
          </View>
          <Slider
            style={{ width: '100%', height: 28 }}
            minimumValue={1}
            maximumValue={10}
            step={1}
            value={settings.level}
            onValueChange={v => updateSettings({ level: Math.round(v) })}
            minimumTrackTintColor={colors.brand}
            maximumTrackTintColor={colors.surface3}
            thumbTintColor={colors.ink}
          />
          <View style={styles.diffTicks}>
            {['1', '3', '5', '7', '10'].map(t => (
              <Text key={t} style={[styles.diffTick, { color: colors.inkMute }]}>{t}</Text>
            ))}
          </View>
        </View>

        {/* Theme toggle */}
        <View style={[styles.toggleRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.toggleLabel, { color: colors.ink }]}>Dark mode</Text>
          <Switch
            value={mode === 'dark'}
            onValueChange={() => { toggleTheme(); updateSettings({ mode: mode === 'dark' ? 'light' : 'dark' }); }}
            trackColor={{ false: colors.surface3, true: colors.brand }}
            thumbColor={colors.surface}
          />
        </View>

        {/* Time control */}
        <View style={[styles.diffBlock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.diffLabel, { color: colors.ink, marginBottom: 12 }]}>Default time control</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {TIME_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => updateSettings({ timeControl: opt.value })}
                style={[
                  styles.timeBtn,
                  {
                    backgroundColor: settings.timeControl === opt.value ? colors.brandSoft : colors.surface2,
                    borderColor: settings.timeControl === opt.value ? colors.brand : colors.border,
                  },
                ]}
              >
                <Text style={[styles.timeBtnText, {
                  color: settings.timeControl === opt.value ? colors.brand2 : colors.ink,
                }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Text style={[styles.sectionKicker, { color: colors.inkMute }]}>Personality</Text>

        {PROFILES.map(p => (
          <ProfileCard
            key={p.name}
            {...p}
            active={settings.personality === p.name}
            onPress={() => updateSettings({ personality: p.name })}
          />
        ))}

        <TouchableOpacity style={styles.ghostBtn}>
          <Text style={[styles.ghostBtnText, { color: colors.ink2 }]}>Customize ›</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 18, gap: 14 },
  diffBlock: { borderWidth: 1, borderRadius: 18, padding: 18, paddingBottom: 16 },
  diffRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
  diffLabel: { fontSize: 14, fontWeight: '600' },
  diffValue: { fontSize: 22, fontWeight: '500', letterSpacing: -0.2 },
  diffElo: { fontSize: 11, fontWeight: '500' },
  diffTicks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  diffTick: { fontSize: 10, fontFamily: 'monospace' },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderWidth: 1, borderRadius: 12,
  },
  toggleLabel: { fontSize: 14, fontWeight: '600' },
  timeBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: 10, borderWidth: 1.5,
  },
  timeBtnText: { fontSize: 13, fontWeight: '600' },
  sectionKicker: {
    fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase',
    letterSpacing: 1.2, marginTop: 4,
  },
  profile: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, paddingHorizontal: 16, borderWidth: 1, borderRadius: 18,
  },
  profileNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileName: { fontSize: 19, fontWeight: '500', letterSpacing: -0.2, lineHeight: 24 },
  profileSub: { fontSize: 12, marginTop: 2 },
  profileDetail: { fontSize: 10, marginTop: 6 },
  radio: {
    width: 22, height: 22, borderRadius: 999, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  ghostBtn: { alignSelf: 'flex-start', marginTop: 4 },
  ghostBtnText: { fontSize: 13, fontWeight: '600' },
});
