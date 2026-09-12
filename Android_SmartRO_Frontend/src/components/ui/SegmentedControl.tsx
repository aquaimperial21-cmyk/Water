import React from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { MotiView } from 'moti';
import { tokens } from '@theme/tokens';

type Option<T extends string> = {
  value: T;
  label: string;
  icon?: React.ReactNode;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  fullWidth = true,
  style,
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  fullWidth?: boolean;
  style?: ViewStyle;
}) {
  const [layouts, setLayouts] = React.useState<Record<string, { x: number; w: number }>>({});
  const onLayout = (val: string) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev) => ({ ...prev, [val]: { x, w: width } }));
  };
  const active = layouts[value];

  return (
    <View style={[styles.track, fullWidth && styles.trackFull, style]}>
      {active ? (
        <MotiView
          animate={{ translateX: active.x, width: active.w }}
          transition={{ type: 'spring', damping: 24, stiffness: 240 }}
          style={styles.thumb}
        />
      ) : null}
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            onLayout={onLayout(opt.value)}
            style={[styles.option, fullWidth && { flex: 1 }]}
            accessibilityState={{ selected: isActive }}
          >
            {opt.icon ? <View style={styles.iconBox}>{opt.icon}</View> : null}
            <Text style={[styles.label, isActive && styles.labelActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: 4,
    backgroundColor: tokens.color.surfaceWarm,
    borderRadius: tokens.radius.full,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  trackFull: { alignSelf: 'stretch' },
  thumb: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.full,
    ...tokens.shadow.xs,
  },
  option: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: tokens.radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  iconBox: { alignItems: 'center', justifyContent: 'center' },
  label: {
    ...tokens.text.bodySmMedium,
    fontSize: 13,
    color: tokens.color.textMuted,
  },
  labelActive: { color: tokens.color.text },
});
