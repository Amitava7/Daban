import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface EvalBarProps {
  pct?: number;   // 0–100, how much white has
  label?: string;
}

export function EvalBar({ pct = 50, label = '+0.0' }: EvalBarProps) {
  const { colors } = useTheme();
  const whitePct = Math.max(5, Math.min(95, pct));

  return (
    <View style={[styles.bar, { backgroundColor: colors.pieceDark }]}>
      <View style={[styles.white, { height: `${whitePct}%` as any, backgroundColor: colors.pieceLight }]} />
      <Text style={[styles.label, { color: colors.ink }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: 16,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    alignSelf: 'stretch',
  },
  white: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  label: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 7,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
});
