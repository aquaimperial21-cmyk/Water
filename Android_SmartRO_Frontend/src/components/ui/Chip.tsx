import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { tokens } from '@theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Chip({
  label,
  selected,
  onPress,
  leading,
  trailing,
  size = 'md',
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const Comp = onPress ? AnimatedPressable : View;
  const interactive = !!onPress;

  return (
    <Comp
      onPress={onPress}
      onPressIn={() => interactive && (scale.value = withTiming(0.96, { duration: 80 }))}
      onPressOut={() => interactive && (scale.value = withTiming(1, { duration: 140 }))}
      style={[
        styles.base,
        size === 'sm' && styles.sm,
        selected ? styles.selected : styles.unselected,
        animatedStyle as any,
        style,
      ]}
    >
      {leading ? <View>{leading}</View> : null}
      <Text
        style={[
          styles.text,
          size === 'sm' && styles.textSm,
          selected ? styles.textSelected : styles.textUnselected,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {trailing ? <View>{trailing}</View> : null}
    </Comp>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: tokens.radius.full,
    borderWidth: 1,
  },
  sm: { height: 30, paddingHorizontal: 12 },
  unselected: {
    backgroundColor: tokens.color.surface,
    borderColor: tokens.color.border,
  },
  selected: {
    backgroundColor: tokens.color.text,
    borderColor: tokens.color.text,
  },
  text: { ...tokens.text.bodySmMedium, fontSize: 13 },
  textSm: { fontSize: 12 },
  textUnselected: { color: tokens.color.textMuted },
  textSelected: { color: tokens.color.surface },
});
