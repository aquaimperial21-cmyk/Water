import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

interface Bubble {
  size: number;
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  color: string;
  opacity?: number;
}

interface Props {
  bubbles?: Bubble[];
  style?: ViewStyle;
}

const DEFAULTS: Bubble[] = [
  { size: 220, top: -80, right: -60, color: '#ffffff', opacity: 0.18 },
  { size: 140, bottom: -40, left: -30, color: '#ffffff', opacity: 0.12 },
  { size: 80, top: 40, left: 30, color: '#ffffff', opacity: 0.18 },
  { size: 50, bottom: 50, right: 60, color: '#ffffff', opacity: 0.22 },
];

export function Bubbles({ bubbles = DEFAULTS, style }: Props) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { overflow: 'hidden' }, style]}>
      {bubbles.map((b, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            width: b.size,
            height: b.size,
            borderRadius: b.size / 2,
            backgroundColor: b.color,
            opacity: b.opacity ?? 0.2,
            top: b.top,
            bottom: b.bottom,
            left: b.left,
            right: b.right,
          }}
        />
      ))}
    </View>
  );
}
