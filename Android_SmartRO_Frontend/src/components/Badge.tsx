import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius, type } from '../theme';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface Props {
  tone?: Tone;
  label: string;
  withDot?: boolean;
  style?: ViewStyle;
}

export function Badge({ tone = 'info', label, withDot = true, style }: Props) {
  const t = tones[tone];
  return (
    <View style={[styles.box, { backgroundColor: t.bg }, style]}>
      {withDot ? <View style={[styles.dot, { backgroundColor: t.dot }]} /> : null}
      <Text style={[styles.text, { color: t.text }]}>{label}</Text>
    </View>
  );
}

const tones: Record<Tone, { bg: string; text: string; dot: string }> = {
  success: { bg: 'rgba(86,245,248,0.18)', text: colors.onSecondaryContainer, dot: colors.secondary },
  warning: { bg: '#fff0c2', text: '#7a5a00', dot: colors.warning },
  danger: { bg: colors.errorContainer, text: colors.onErrorContainer, dot: colors.error },
  info: { bg: 'rgba(0,89,187,0.10)', text: colors.primary, dot: colors.primary },
  neutral: { bg: colors.surfaceContainerHigh, text: colors.onSurfaceVariant, dot: colors.outline },
};

const styles = StyleSheet.create({
  box: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { ...type.labelSm, fontSize: 10 },
});
