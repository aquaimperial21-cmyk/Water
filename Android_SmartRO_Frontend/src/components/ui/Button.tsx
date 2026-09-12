import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { tokens } from '@theme/tokens';
import { tv } from './tv';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'destructive' | 'soft';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const container = tv({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space['2'],
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  variants: {
    variant: {
      primary: { backgroundColor: tokens.color.accent },
      secondary: { backgroundColor: tokens.color.text },
      soft: { backgroundColor: tokens.color.accentSoft, borderColor: tokens.color.accentSoftStrong },
      outline: { backgroundColor: tokens.color.surface, borderColor: tokens.color.border },
      ghost: { backgroundColor: 'transparent' },
      destructive: { backgroundColor: tokens.color.danger },
    },
    size: {
      sm: { height: 36, paddingHorizontal: tokens.space['4'] },
      md: { height: 44, paddingHorizontal: tokens.space['5'] },
      lg: { height: 54, paddingHorizontal: tokens.space['6'], borderRadius: tokens.radius.lg },
      icon: { height: 44, width: 44, paddingHorizontal: 0 },
    },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
});

const labelColorMap: Record<Variant, string> = {
  primary: '#FFFFFF',
  secondary: '#FFFFFF',
  soft: tokens.color.accentInk,
  outline: tokens.color.text,
  ghost: tokens.color.text,
  destructive: '#FFFFFF',
};

const labelStyle = tv({
  base: { ...tokens.text.bodySmMedium, letterSpacing: 0.1 },
  variants: {
    size: {
      sm: { fontSize: 13 },
      md: { fontSize: 14 },
      lg: { fontSize: 15 },
      icon: { fontSize: 0 },
    },
  },
  defaultVariants: { size: 'md' },
});

export type ButtonProps = {
  title?: string;
  onPress?: PressableProps['onPress'];
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  haptic?: boolean;
  style?: ViewStyle;
  /** content slot for icon-only buttons */
  children?: React.ReactNode;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  fullWidth,
  iconLeft,
  iconRight,
  haptic = true,
  style,
  children,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const labelColor = labelColorMap[variant];

  const onPressIn = () => {
    scale.value = withTiming(0.97, { duration: 90 });
  };
  const onPressOut = () => {
    scale.value = withTiming(1, { duration: 140 });
  };
  const onPressInner: PressableProps['onPress'] = (e) => {
    if (isDisabled) return;
    if (haptic && Platform.OS !== 'web' && variant !== 'ghost') {
      Haptics.selectionAsync().catch(() => {});
    }
    onPress?.(e);
  };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={onPressInner}
      disabled={isDisabled}
      style={[
        container({ variant, size }),
        animatedStyle,
        variant === 'primary' && tokens.shadow.sm,
        fullWidth && { alignSelf: 'stretch' },
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={labelColor} size="small" />
      ) : (
        <View style={styles.row}>
          {iconLeft ? <View style={{ marginRight: title ? 0 : 0 }}>{iconLeft}</View> : null}
          {title ? (
            <Text style={[labelStyle({ size }), { color: labelColor }]} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {children}
          {iconRight ? <View>{iconRight}</View> : null}
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.space['2'] },
  disabled: { opacity: 0.5 },
});
