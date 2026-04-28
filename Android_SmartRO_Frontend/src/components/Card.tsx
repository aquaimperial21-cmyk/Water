import React from 'react';
import { Pressable, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { colors, radius, spacing, shadow } from '../theme';

interface Props extends ViewProps {
  onPress?: () => void;
  variant?: 'plain' | 'elevated' | 'outlined' | 'tonal';
  pad?: keyof typeof spacing | 'none';
  style?: ViewStyle | ViewStyle[];
}

export function Card({ children, style, onPress, variant = 'elevated', pad = 'lg', ...rest }: Props) {
  const padStyle = pad === 'none' ? null : { padding: spacing[pad] };
  const variantStyle = variantStyles[variant];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.base, variantStyle, padStyle, pressed && styles.pressed, style as ViewStyle]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View style={[styles.base, variantStyle, padStyle, style as ViewStyle]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.lg, backgroundColor: colors.surfaceContainerLowest },
  pressed: { opacity: 0.92, transform: [{ scale: 0.995 }] },
});

const variantStyles: Record<NonNullable<Props['variant']>, ViewStyle> = {
  plain: {},
  elevated: {
    backgroundColor: colors.surfaceContainerLowest,
    ...shadow.md,
    borderWidth: 1,
    borderColor: 'rgba(193,198,215,0.4)',
  },
  outlined: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  tonal: {
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: 'rgba(193,198,215,0.4)',
  },
};
