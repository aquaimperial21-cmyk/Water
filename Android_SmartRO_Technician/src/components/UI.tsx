import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';

export function Screen({ children, scroll, padded = true, style }: ViewProps & { scroll?: boolean; padded?: boolean }) {
  if (scroll) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <ScrollView contentContainerStyle={[padded && s.padded, style as ViewStyle]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={[s.root, padded && s.padded, style as ViewStyle]}>{children}</View>
    </SafeAreaView>
  );
}

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({ title, onPress, variant = 'primary', loading, disabled, style }: ButtonProps) {
  const v = btn[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [s.btnBase, v.container, (disabled || loading) && { opacity: 0.5 }, pressed && { opacity: 0.85 }, style]}
    >
      {loading ? <ActivityIndicator color={v.text.color} /> : <Text style={v.text}>{title}</Text>}
    </Pressable>
  );
}

const btn: Record<string, { container: ViewStyle; text: { color: string; fontWeight: '600' | '700' } }> = {
  primary: { container: { backgroundColor: colors.primary }, text: { color: '#fff', fontWeight: '700' } },
  secondary: { container: { backgroundColor: colors.primaryLight }, text: { color: colors.primary, fontWeight: '700' } },
  ghost: { container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border }, text: { color: colors.text, fontWeight: '600' } },
  danger: { container: { backgroundColor: colors.danger }, text: { color: '#fff', fontWeight: '700' } },
};

export function Input({ label, error, ...rest }: TextInputProps & { label?: string; error?: string }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput placeholderTextColor={colors.textMuted} style={[s.input, !!error && s.inputError]} {...rest} />
      {error ? <Text style={s.errorText}>{error}</Text> : null}
    </View>
  );
}

export function Card({ children, style, onPress }: ViewProps & { onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }, style as ViewStyle]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[s.card, style as ViewStyle]}>{children}</View>;
}

export function Badge({ tone = 'info', label }: { tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral'; label: string }) {
  const tones: Record<string, { bg: string; text: string }> = {
    success: { bg: '#E1F5EC', text: colors.success },
    warning: { bg: '#FFF4DC', text: colors.warning },
    danger: { bg: '#FBE3E3', text: colors.danger },
    info: { bg: colors.primaryLight, text: colors.primary },
    neutral: { bg: '#EEF1F4', text: colors.textMuted },
  };
  const t = tones[tone] ?? tones.info!;
  return (
    <View style={[s.badge, { backgroundColor: t.bg }]}>
      <Text style={[s.badgeText, { color: t.text }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  root: { flex: 1, backgroundColor: colors.bg },
  padded: { padding: spacing.lg },
  btnBase: { borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: spacing.xl, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  input: { borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15, color: colors.text },
  inputError: { borderColor: colors.danger },
  errorText: { color: colors.danger, fontSize: 12, marginTop: spacing.xs },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
});
