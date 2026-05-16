import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';

type PillTone = 'default' | 'brand' | 'good' | 'good-soft' | 'warn' | 'warn-soft' | 'bad' | 'bad-soft' | 'outlined' | 'outlined-brand';

interface PillProps {
  children: React.ReactNode;
  tone?: PillTone;
  style?: ViewStyle;
}

export function Pill({ children, tone = 'default', style }: PillProps) {
  const { colors } = useTheme();

  const bgMap: Record<PillTone, string> = {
    'default':       colors.surface2,
    'brand':         colors.brand,
    'good':          colors.good,
    'good-soft':     colors.goodSoft,
    'warn':          colors.warn,
    'warn-soft':     colors.warnSoft,
    'bad':           colors.bad,
    'bad-soft':      colors.badSoft,
    'outlined':      'transparent',
    'outlined-brand':'transparent',
  };

  const colorMap: Record<PillTone, string> = {
    'default':       colors.ink2,
    'brand':         colors.onBrand,
    'good':          '#fff',
    'good-soft':     colors.good,
    'warn':          '#fff',
    'warn-soft':     colors.warn,
    'bad':           '#fff',
    'bad-soft':      colors.bad,
    'outlined':      colors.ink2,
    'outlined-brand':colors.brand,
  };

  const borderMap: Record<PillTone, string | undefined> = {
    'default':       undefined,
    'brand':         undefined,
    'good':          undefined,
    'good-soft':     undefined,
    'warn':          undefined,
    'warn-soft':     undefined,
    'bad':           undefined,
    'bad-soft':      undefined,
    'outlined':      colors.border,
    'outlined-brand':colors.brand,
  };

  return (
    <View style={[
      styles.pill,
      { backgroundColor: bgMap[tone] },
      borderMap[tone] && { borderWidth: 1, borderColor: borderMap[tone] },
      style,
    ]}>
      <Text style={[styles.text, { color: colorMap[tone] }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
