import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { tokens } from '@theme/tokens';
import { tv } from './tv';

type Tone = 'neutral' | 'accent' | 'success' | 'warn' | 'danger';
type Size = 'sm' | 'md';

const container = tv({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: tokens.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  variants: {
    tone: {
      neutral: { backgroundColor: tokens.color.surfaceMuted, borderColor: tokens.color.border },
      accent: { backgroundColor: tokens.color.accentSoft, borderColor: tokens.color.accentSoftStrong },
      success: { backgroundColor: tokens.color.successSoft, borderColor: 'rgba(16,185,129,0.3)' },
      warn: { backgroundColor: tokens.color.warnSoft, borderColor: 'rgba(245,158,11,0.3)' },
      danger: { backgroundColor: tokens.color.dangerSoft, borderColor: 'rgba(225,29,72,0.25)' },
    },
    size: {
      sm: { paddingHorizontal: 8, paddingVertical: 2 },
      md: { paddingHorizontal: 10, paddingVertical: 4 },
    },
  },
  defaultVariants: { tone: 'neutral', size: 'md' },
});

const inkColor: Record<Tone, string> = {
  neutral: tokens.color.textMuted,
  accent: tokens.color.accentInk,
  success: '#065F46',
  warn: '#92400E',
  danger: '#9F1239',
};

const dotColor: Record<Tone, string> = {
  neutral: tokens.color.textSubtle,
  accent: tokens.color.accent,
  success: tokens.color.success,
  warn: tokens.color.warn,
  danger: tokens.color.danger,
};

export function Badge({
  label,
  tone = 'neutral',
  size = 'md',
  dot,
  icon,
  style,
}: {
  label: string;
  tone?: Tone;
  size?: Size;
  dot?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[container({ tone, size }), style]}>
      {dot ? <View style={[styles.dot, { backgroundColor: dotColor[tone] }]} /> : null}
      {icon}
      <Text
        style={[
          styles.text,
          {
            color: inkColor[tone],
            fontSize: size === 'sm' ? 11 : 12,
            letterSpacing: 0.4,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { ...tokens.text.label, textTransform: 'none' as const },
});
