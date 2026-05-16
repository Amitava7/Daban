import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface AppBarProps {
  left?: string | null;
  title?: string;
  sub?: string;
  right?: string | null;
  onLeft?: () => void;
  onRight?: () => void;
}

export function AppBar({ left = '‹', title = '', sub, right = '⚙', onLeft, onRight }: AppBarProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.bar, { backgroundColor: colors.surface }]}>
      <TouchableOpacity style={styles.btn} onPress={onLeft}>
        {left ? <Text style={[styles.btnText, { color: colors.ink2 }]}>{left}</Text> : <View style={styles.btnPlaceholder} />}
      </TouchableOpacity>

      <View style={styles.center}>
        <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={[styles.sub, { color: colors.inkSoft }]} numberOfLines={1}>{sub}</Text> : null}
      </View>

      <TouchableOpacity style={styles.btn} onPress={onRight}>
        {right ? <Text style={[styles.btnText, { color: colors.ink2 }]}>{right}</Text> : <View style={styles.btnPlaceholder} />}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
  },
  btn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  btnPlaceholder: { width: 36 },
  btnText: { fontSize: 20 },
  center: { flex: 1, alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  sub: { fontSize: 11, fontWeight: '500', marginTop: 1 },
});
