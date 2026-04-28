import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, type } from '../theme';

interface Props {
  title: string;
  caption?: string;
  action?: { label: string; onPress: () => void };
  style?: ViewStyle;
}

export function SectionHeader({ title, caption, action, style }: Props) {
  return (
    <View style={[styles.row, style]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      </View>
      {action ? (
        <Pressable onPress={action.onPress} style={styles.action} hitSlop={6}>
          <Text style={styles.actionText}>{action.label}</Text>
          <MaterialIcons name="chevron-right" size={18} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.margin,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  title: { ...type.headlineMd, color: colors.onSurface, fontSize: 20 },
  caption: { ...type.caption, color: colors.outline, marginTop: 2 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionText: { ...type.labelMd, color: colors.primary, fontSize: 12 },
});
