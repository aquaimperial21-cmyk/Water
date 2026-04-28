import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle, TextStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, radius, spacing, type, shadow } from '../theme';

type Variant = 'primary' | 'secondary' | 'tonal' | 'ghost' | 'danger';
type Size = 'lg' | 'md' | 'sm';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

interface Props {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  iconLeft?: IconName;
  iconRight?: IconName;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  loading,
  disabled,
  fullWidth,
  iconLeft,
  iconRight,
  style,
}: Props) {
  const isDisabled = disabled || loading;
  const v = variants[variant];
  const s = sizes[size];
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        s.container,
        v.container,
        fullWidth && { alignSelf: 'stretch' },
        variant === 'primary' && shadow.sm,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.color} size="small" />
      ) : (
        <View style={styles.row}>
          {iconLeft ? <MaterialIcons name={iconLeft} size={s.icon} color={v.color} /> : null}
          <Text style={[type.labelMd, { color: v.color }, s.text]}>{title}</Text>
          {iconRight ? <MaterialIcons name={iconRight} size={s.icon} color={v.color} /> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
});

const sizes: Record<Size, { container: ViewStyle; text: TextStyle; icon: number }> = {
  lg: {
    container: { paddingVertical: 14, paddingHorizontal: spacing.lg, minHeight: 52 },
    text: { fontSize: 14 },
    icon: 20,
  },
  md: {
    container: { paddingVertical: 10, paddingHorizontal: spacing.md, minHeight: 44 },
    text: { fontSize: 13 },
    icon: 18,
  },
  sm: {
    container: { paddingVertical: 6, paddingHorizontal: spacing.md, minHeight: 32 },
    text: { fontSize: 12 },
    icon: 16,
  },
};

const variants: Record<Variant, { container: ViewStyle; color: string }> = {
  primary: {
    container: { backgroundColor: colors.primary },
    color: colors.onPrimary,
  },
  secondary: {
    container: { backgroundColor: 'rgba(0,89,187,0.1)' },
    color: colors.primary,
  },
  tonal: {
    container: { backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: colors.outlineVariant },
    color: colors.onSurfaceVariant,
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    color: colors.primary,
  },
  danger: {
    container: { backgroundColor: colors.error },
    color: colors.onError,
  },
};
