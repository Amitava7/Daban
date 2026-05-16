import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface NavRowProps {
  glyph: string;
  title: string;
  meta: string;
  tone?: 'brand' | 'good' | 'default';
  onPress?: () => void;
}

export function NavRow({ glyph, title, meta, tone = 'default', onPress }: NavRowProps) {
  const { colors } = useTheme();

  const iconBg = tone === 'brand' ? colors.brandSoft : tone === 'good' ? colors.goodSoft : colors.surface2;
  const iconColor = tone === 'brand' ? colors.brand : tone === 'good' ? colors.good : colors.ink2;

  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.icon, { backgroundColor: iconBg }]}>
        <Text style={[styles.glyph, { color: iconColor }]}>{glyph}</Text>
      </View>
      <View style={styles.grow}>
        <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
        <Text style={[styles.meta, { color: colors.inkSoft }]}>{meta}</Text>
      </View>
      <Text style={[styles.chev, { color: colors.inkMute }]}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 12,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    fontSize: 20,
    fontFamily: 'serif',
  },
  grow: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600', lineHeight: 18 },
  meta: { fontSize: 12, marginTop: 2 },
  chev: { fontSize: 18 },
});
