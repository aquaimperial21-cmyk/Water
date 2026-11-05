import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MotiView } from 'moti';
import { Check } from 'lucide-react-native';
import { tokens } from '@theme/tokens';

type Props = {
  steps: string[];
  current: number;
};

export function Stepper({ steps, current }: Props) {
  return (
    <View style={styles.row}>
      {steps.map((label, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <View key={label} style={styles.item}>
            <StepBar filled={done || active} />
            <View style={styles.labelRow}>
              <View
                style={[
                  styles.dot,
                  done && styles.dotDone,
                  active && styles.dotActive,
                ]}
              >
                {done ? (
                  <Check size={12} color="#FFF" strokeWidth={3} />
                ) : (
                  <Text style={[styles.dotText, active && { color: '#FFF' }]}>{i + 1}</Text>
                )}
              </View>
              <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
                {label}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// The fill is always full width and slides in from the left; the bar clips it.
// Moving it with translateX (not a % width) keeps layout out of every frame.
// It waits for the bar's width so it can start fully off to the left.
function StepBar({ filled }: { filled: boolean }) {
  const [w, setW] = React.useState(0);
  return (
    <View style={styles.bar} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 ? (
        <MotiView
          from={{ translateX: -w }}
          animate={{ translateX: filled ? 0 : -w }}
          transition={{ type: 'timing', duration: 360 }}
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: tokens.color.accent, borderRadius: 999 },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: tokens.space['2'] },
  item: { flex: 1 },
  bar: {
    height: 4,
    borderRadius: 999,
    backgroundColor: tokens.color.surfaceMuted,
    overflow: 'hidden',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space['2'],
    marginTop: tokens.space['2'],
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: tokens.color.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  dotDone: { backgroundColor: tokens.color.accent, borderColor: tokens.color.accent },
  dotActive: { backgroundColor: tokens.color.text, borderColor: tokens.color.text },
  dotText: { ...tokens.text.label, fontSize: 11, color: tokens.color.textMuted },
  label: { ...tokens.text.bodySmMedium, fontSize: 12, color: tokens.color.textSubtle, flex: 1 },
  labelActive: { color: tokens.color.text },
});
