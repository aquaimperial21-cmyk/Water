import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, type } from '../theme';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

interface Props {
  title?: string;
  showLogo?: boolean;
  onBack?: () => void;
  rightIcon?: IconName;
  onRight?: () => void;
}

export function AppHeader({ title, showLogo, onBack, rightIcon, onRight }: Props) {
  return (
    <View style={styles.header}>
      <View style={styles.left}>
        {onBack ? (
          <Pressable onPress={onBack} style={styles.iconBtn}>
            <MaterialIcons name="arrow-back" size={24} color={colors.onSurfaceVariant} />
          </Pressable>
        ) : null}
        {showLogo ? (
          <View style={styles.logoRow}>
            <MaterialIcons name="opacity" size={20} color={colors.primary} />
            <Text style={styles.logoText}>SmartRO</Text>
          </View>
        ) : title ? (
          <Text style={styles.titleText}>{title}</Text>
        ) : null}
      </View>
      <View style={styles.right}>
        {rightIcon ? (
          <Pressable onPress={onRight} style={styles.iconBtn}>
            <MaterialIcons name={rightIcon} size={22} color={colors.onSurfaceVariant} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(193,198,215,0.4)',
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logoText: { ...type.titleLg, color: colors.primary, fontSize: 20 },
  titleText: { ...type.titleMd, color: colors.onSurface },
});
