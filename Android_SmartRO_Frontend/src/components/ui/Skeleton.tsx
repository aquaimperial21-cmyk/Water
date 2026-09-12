import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { MotiView } from 'moti';
import { tokens } from '@theme/tokens';

type Props = {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: ViewStyle;
};

export function Skeleton({ width = '100%', height = 16, radius = tokens.radius.sm, style }: Props) {
  return (
    <View style={[{ width: width as any, height, borderRadius: radius, overflow: 'hidden' }, style]}>
      <MotiView
        from={{ opacity: 0.55 }}
        animate={{ opacity: 1 }}
        transition={{ type: 'timing', duration: 900, loop: true, repeatReverse: true }}
        style={styles.fill}
      />
    </View>
  );
}

export function SkeletonCard({ height = 180, style }: { height?: number; style?: ViewStyle }) {
  return (
    <View style={[styles.card, { height }, style]}>
      <Skeleton width="60%" height={14} radius={6} />
      <View style={{ height: 12 }} />
      <Skeleton width="100%" height={1} radius={1} style={{ backgroundColor: tokens.color.border }} />
      <View style={{ height: 16 }} />
      <Skeleton width="100%" height={64} radius={tokens.radius.md} />
      <View style={{ height: 12 }} />
      <Skeleton width="40%" height={12} radius={6} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: tokens.color.surfaceMuted,
  },
  card: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: tokens.space['4'],
  },
});
