import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../theme';

interface Props {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'lg' | 'md' | 'sm';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({ title, onPress, variant = 'primary', size = 'lg', loading, disabled, style }: Props) {
  const v = variants[variant];
  const s = sizes[size];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        s.container,
        v.container,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={v.text.color} />
        ) : (
          <Text style={[v.text, s.text]}>{title}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});

const sizes = StyleSheet.create({
  lg: {},
  md: {},
  sm: {},
} as never) as Record<'lg' | 'md' | 'sm', { container: ViewStyle; text: { fontSize: number } }>;
sizes.lg = { container: { paddingVertical: 14, paddingHorizontal: spacing.xl }, text: { fontSize: 16 } };
sizes.md = { container: { paddingVertical: 10, paddingHorizontal: spacing.lg }, text: { fontSize: 14 } };
sizes.sm = { container: { paddingVertical: 6, paddingHorizontal: spacing.md }, text: { fontSize: 12 } };

const variants = {
  primary: {
    container: { backgroundColor: colors.primary },
    text: { color: '#fff', fontWeight: '600' as const },
  },
  secondary: {
    container: { backgroundColor: colors.primaryLight },
    text: { color: colors.primary, fontWeight: '600' as const },
  },
  ghost: {
    container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
    text: { color: colors.text, fontWeight: '500' as const },
  },
  danger: {
    container: { backgroundColor: colors.danger },
    text: { color: '#fff', fontWeight: '600' as const },
  },
};
