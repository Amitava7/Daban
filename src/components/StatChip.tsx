import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface StatChipProps {
  label: string;
  value: string;
  delta?: string;
  suffix?: string;
}

export function StatChip({ label, value, delta, suffix }: StatChipProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.inkMute }]}>{label}</Text>
      <View style={styles.row}>
        <Text style={[styles.value, { color: colors.ink, fontFamily: 'serif' }]}>{value}</Text>
        {suffix && <Text style={styles.suffix}>{suffix}</Text>}
        {delta && <Text style={[styles.delta, { color: colors.good }]}>{delta}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  label: {
    fontSize: 10,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 2,
  },
  value: {
    fontSize: 19,
    fontWeight: '500',
    lineHeight: 22,
  },
  suffix: { fontSize: 13 },
  delta: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
});
