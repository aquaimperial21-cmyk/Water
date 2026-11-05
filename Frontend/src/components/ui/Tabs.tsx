import React from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { MotiView } from 'moti';
import { tokens } from '@theme/tokens';

type Tab = { value: string; label: string };

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: Tab[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [layouts, setLayouts] = React.useState<Record<string, { x: number; w: number }>>({});

  const onLayoutTab = (val: string) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev) => ({ ...prev, [val]: { x, w: width } }));
  };

  const active = layouts[value];

  return (
    <View style={styles.outer}>
      <View style={styles.row}>
        {tabs.map((t) => {
          const isActive = t.value === value;
          return (
            <Pressable
              key={t.value}
              onPress={() => onChange(t.value)}
              onLayout={onLayoutTab(t.value)}
              style={styles.tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[styles.label, isActive && styles.labelActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {active ? (
        <MotiView
          animate={{ translateX: active.x, width: active.w }}
          transition={{ type: 'spring', damping: 22, stiffness: 220 }}
          style={styles.indicator}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.border,
  },
  row: { flexDirection: 'row', gap: tokens.space['5'] },
  tab: { paddingVertical: tokens.space['3'] },
  label: {
    ...tokens.text.bodySmMedium,
    fontSize: 14,
    color: tokens.color.textMuted,
  },
  labelActive: { color: tokens.color.text },
  indicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    height: 2,
    backgroundColor: tokens.color.accent,
    borderRadius: 999,
  },
});
