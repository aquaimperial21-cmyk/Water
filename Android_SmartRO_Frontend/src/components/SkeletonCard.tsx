import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius } from '../theme';

interface Props {
  height?: number;
  style?: ViewStyle;
}

export function SkeletonCard({ height = 220, style }: Props) {
  const opacity = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.card, { height, opacity }, style]}>
      <View style={styles.image} />
      <View style={{ padding: 14 }}>
        <View style={[styles.line, { width: '70%' }]} />
        <View style={[styles.line, { width: '50%', marginTop: 8 }]} />
        <View style={styles.row}>
          <View style={styles.pill} />
          <View style={styles.pill} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(193,198,215,0.4)',
    marginBottom: 16,
  },
  image: { backgroundColor: colors.surfaceContainer, height: 140 },
  line: { height: 14, backgroundColor: colors.surfaceContainer, borderRadius: 6 },
  row: { flexDirection: 'row', gap: 8, marginTop: 12 },
  pill: { width: 60, height: 22, backgroundColor: colors.surfaceContainer, borderRadius: 999 },
});
