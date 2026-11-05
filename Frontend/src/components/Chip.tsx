import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, radius, spacing, type } from '../theme';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

interface Props {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: IconName;
  style?: ViewStyle;
  size?: 'sm' | 'md';
  tone?: 'default' | 'danger';
}

export function Chip({ label, active, onPress, icon, style, size = 'md', tone = 'default' }: Props) {
  const dangerActive = tone === 'danger' && active;
  const bg = dangerActive
    ? colors.error
    : active
    ? colors.primary
    : colors.surfaceContainerLowest;
  const fg = dangerActive ? colors.onError : active ? colors.onPrimary : colors.onSurfaceVariant;
  const borderColor = dangerActive ? colors.error : active ? colors.primary : colors.outlineVariant;
  const padV = size === 'sm' ? 4 : 8;
  const padH = size === 'sm' ? 10 : 16;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, borderColor, paddingHorizontal: padH, paddingVertical: padV },
        pressed && !!onPress && { opacity: 0.85 },
        style,
      ]}
    >
      {icon ? <MaterialIcons name={icon} size={16} color={fg} /> : null}
      <Text style={[type.labelMd, { color: fg, fontSize: size === 'sm' ? 11 : 13 }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
});
