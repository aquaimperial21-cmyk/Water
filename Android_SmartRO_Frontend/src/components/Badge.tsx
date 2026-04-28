import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';

interface Props { tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral'; label: string; }

export function Badge({ tone = 'info', label }: Props) {
  const t = tones[tone];
  return (
    <View style={[styles.box, { backgroundColor: t.bg }]}>
      <Text style={[styles.text, { color: t.text }]}>{label}</Text>
    </View>
  );
}

const tones: Record<string, { bg: string; text: string }> = {
  success: { bg: '#E1F5EC', text: colors.success },
  warning: { bg: '#FFF4DC', text: colors.warning },
  danger: { bg: '#FBE3E3', text: colors.danger },
  info: { bg: colors.primaryLight, text: colors.primary },
  neutral: { bg: '#EEF1F4', text: colors.textMuted },
};

const styles = StyleSheet.create({
  box: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm },
  text: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
});
