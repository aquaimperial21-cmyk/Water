import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { tokens } from '@theme/tokens';

export type PillTone =
  | 'neutral'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'ink';

const toneBg: Record<PillTone, string> = {
  neutral: tokens.color.surfaceWarm,
  accent: tokens.color.accentSoft,
  success: tokens.color.successSoft,
  warning: tokens.color.warnSoft,
  danger: tokens.color.dangerSoft,
  ink: tokens.color.text,
};

const toneFg: Record<PillTone, string> = {
  neutral: tokens.color.inkSoft,
  accent: tokens.color.accentInk,
  success: tokens.color.success,
  warning: tokens.color.warn,
  danger: tokens.color.danger,
  ink: tokens.color.bg,
};

const toneDot: Record<PillTone, string> = {
  neutral: tokens.color.textMuted,
  accent: tokens.color.accent,
  success: tokens.color.success,
  warning: tokens.color.warn,
  danger: tokens.color.danger,
  ink: tokens.color.bg,
};

export function Pill({
  children,
  tone = 'neutral',
  dot,
  size = 'md',
  style,
}: {
  children: React.ReactNode;
  tone?: PillTone;
  dot?: boolean;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}) {
  const bg = toneBg[tone];
  const fg = toneFg[tone];
  const dotColor = toneDot[tone];

  return (
    <View
      style={[
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        { backgroundColor: bg },
        style,
      ]}
    >
      {dot ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
      <Text
        style={[
          size === 'sm' ? styles.textSm : styles.textMd,
          { color: fg },
        ]}
        numberOfLines={1}
      >
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  sm: { paddingHorizontal: 8, paddingVertical: 3 },
  md: { paddingHorizontal: 10, paddingVertical: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  textSm: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 10.5,
    letterSpacing: 0.2,
  },
  textMd: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11.5,
    letterSpacing: 0.2,
  },
});
