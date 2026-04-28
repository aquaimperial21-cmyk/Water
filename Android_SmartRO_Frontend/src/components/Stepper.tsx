import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, type } from '../theme';

interface Props {
  steps: string[];
  current: number; // 0-indexed
}

export function Stepper({ steps, current }: Props) {
  return (
    <View style={styles.row}>
      {steps.map((label, idx) => {
        const done = idx < current;
        const active = idx === current;
        const dotColor = done || active ? colors.primary : colors.surfaceContainerHigh;
        const labelColor = done || active ? colors.primary : colors.onSurfaceVariant;
        return (
          <React.Fragment key={label}>
            <View style={styles.cell}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: dotColor, borderWidth: active ? 0 : 1, borderColor: colors.outlineVariant },
                ]}
              >
                {done ? (
                  <MaterialIcons name="check" size={14} color={colors.onPrimary} />
                ) : active ? (
                  <View style={styles.innerDot} />
                ) : null}
              </View>
              <Text style={[styles.label, { color: labelColor }]} numberOfLines={1}>{label}</Text>
            </View>
            {idx < steps.length - 1 ? (
              <View style={[styles.bar, { backgroundColor: idx < current ? colors.primary : colors.surfaceVariant }]} />
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  cell: { alignItems: 'center', width: 64 },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.onPrimary },
  bar: { flex: 1, height: 2 },
  label: {
    ...type.labelSm,
    fontSize: 11,
    marginTop: 6,
  },
});
