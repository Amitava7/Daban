import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';

type CardVariant = 'default' | 'flat' | 'brand' | 'good' | 'warn' | 'bad';

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  style?: ViewStyle;
  tight?: boolean;
  loose?: boolean;
}

export function Card({ children, variant = 'default', style, tight, loose }: CardProps) {
  const { colors } = useTheme();

  const bgMap: Record<CardVariant, string> = {
    default: colors.surface,
    flat:    colors.surface,
    brand:   colors.brandSoft,
    good:    colors.goodSoft,
    warn:    colors.warnSoft,
    bad:     colors.badSoft,
  };

  const borderMap: Record<CardVariant, string> = {
    default: colors.border,
    flat:    colors.borderSoft,
    brand:   colors.brandTint,
    good:    colors.goodBorder,
    warn:    colors.warnBorder,
    bad:     colors.badBorder,
  };

  const padding = tight ? 12 : loose ? 20 : 16;

  return (
    <View style={[
      styles.card,
      { backgroundColor: bgMap[variant], borderColor: borderMap[variant], padding },
      style,
    ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
  },
});
