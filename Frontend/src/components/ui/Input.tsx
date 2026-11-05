import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { tokens } from '@theme/tokens';

export type InputProps = Omit<TextInputProps, 'style'> & {
  label?: string;
  hint?: string;
  error?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  containerStyle?: ViewStyle;
  size?: 'md' | 'lg';
};

export function Input({
  label,
  hint,
  error,
  leading,
  trailing,
  containerStyle,
  size = 'md',
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const [focused, setFocused] = React.useState(false);
  const translateX = useSharedValue(0);
  const errorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  React.useEffect(() => {
    if (error) {
      translateX.value = withSequence(
        withTiming(-6, { duration: 50 }),
        withTiming(6, { duration: 60 }),
        withTiming(-4, { duration: 60 }),
        withTiming(0, { duration: 80 }),
      );
    }
  }, [error, translateX]);

  return (
    <View style={containerStyle}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Animated.View
        style={[
          styles.field,
          size === 'lg' && styles.fieldLg,
          focused && styles.fieldFocused,
          !!error && styles.fieldError,
          errorStyle,
        ]}
      >
        {leading ? <View style={styles.adornment}>{leading}</View> : null}
        <TextInput
          placeholderTextColor={tokens.color.textSubtle}
          style={[styles.input, size === 'lg' && styles.inputLg]}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {trailing ? <View style={styles.adornment}>{trailing}</View> : null}
      </Animated.View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...tokens.text.bodySmMedium,
    color: tokens.color.textMuted,
    marginBottom: tokens.space['2'],
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space['2'],
    height: 48,
    paddingHorizontal: tokens.space['4'],
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface,
  },
  fieldLg: { height: 56, paddingHorizontal: tokens.space['5'], borderRadius: tokens.radius.lg },
  fieldFocused: {
    borderColor: tokens.color.accent,
    shadowColor: tokens.color.accent,
    shadowOpacity: 0.18,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  fieldError: { borderColor: tokens.color.danger, backgroundColor: tokens.color.dangerSoft },
  adornment: { alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1,
    ...tokens.text.body,
    color: tokens.color.text,
    paddingVertical: 0,
  },
  inputLg: { fontSize: 17 },
  hint: {
    ...tokens.text.caption,
    color: tokens.color.textSubtle,
    marginTop: tokens.space['2'],
  },
  error: {
    ...tokens.text.caption,
    color: tokens.color.danger,
    marginTop: tokens.space['2'],
  },
});
