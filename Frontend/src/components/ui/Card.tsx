import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { tokens } from '@theme/tokens';
import { tv } from './tv';

type Variant = 'flat' | 'elevated' | 'tinted' | 'sunken' | 'outlineAccent';
type Padding = 'none' | 'sm' | 'md' | 'lg';

const containerStyle = tv({
  base: {
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface,
  },
  variants: {
    variant: {
      flat: { backgroundColor: tokens.color.surface },
      elevated: { backgroundColor: tokens.color.surface, ...tokens.shadow.sm },
      tinted: { backgroundColor: tokens.color.accentSoft, borderColor: tokens.color.accentSoftStrong },
      sunken: { backgroundColor: tokens.color.surfaceMuted, borderColor: tokens.color.border },
      outlineAccent: { backgroundColor: tokens.color.surface, borderColor: tokens.color.accent, borderWidth: 1.5 },
    },
    padding: {
      none: { padding: 0 },
      sm: { padding: tokens.space['3'] },
      md: { padding: tokens.space['4'] },
      lg: { padding: tokens.space['6'] },
    },
  },
  defaultVariants: { variant: 'flat', padding: 'md' },
});

type Props = {
  variant?: Variant;
  padding?: Padding;
  onPress?: () => void;
  style?: ViewStyle;
  children?: React.ReactNode;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Card({ variant, padding, onPress, style, children }: Props) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (!onPress) {
    return <View style={[containerStyle({ variant, padding }), style]}>{children}</View>;
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => (scale.value = withTiming(0.985, { duration: 90 }))}
      onPressOut={() => (scale.value = withTiming(1, { duration: 160 }))}
      style={[containerStyle({ variant, padding }), animatedStyle, style]}
    >
      {children}
    </AnimatedPressable>
  );
}

export function CardHeader({
  title,
  subtitle,
  trailing,
  style,
}: {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.header, style]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space['3'],
    marginBottom: tokens.space['3'],
  },
  title: { ...tokens.text.headingMd, color: tokens.color.text },
  subtitle: { ...tokens.text.bodySm, color: tokens.color.textMuted, marginTop: 2 },
});
