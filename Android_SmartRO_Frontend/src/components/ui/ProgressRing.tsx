import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { MotiView } from 'moti';
import { tokens } from '@theme/tokens';

type Props = {
  /** 0..1 */
  progress: number;
  size?: number;
  stroke?: number;
  label?: string;
  caption?: string;
  pulse?: boolean;
};

export function ProgressRing({
  progress,
  size = 120,
  stroke = 10,
  label,
  caption,
  pulse = true,
}: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  const dash = c * clamped;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <MotiView
        from={pulse ? { scale: 0.985, opacity: 0.94 } : { scale: 1, opacity: 1 }}
        animate={pulse ? { scale: 1.015, opacity: 1 } : { scale: 1, opacity: 1 }}
        transition={
          pulse
            ? { type: 'timing', duration: 2400, loop: true, repeatReverse: true }
            : { type: 'timing', duration: 0 }
        }
        style={StyleSheet.absoluteFillObject}
      >
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={tokens.color.accent} />
              <Stop offset="1" stopColor={tokens.color.accentGlow} />
            </LinearGradient>
          </Defs>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={tokens.color.surfaceMuted}
            strokeWidth={stroke}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="url(#ringGrad)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            fill="none"
          />
        </Svg>
      </MotiView>
      <View style={styles.center} pointerEvents="none">
        {label ? <Text style={styles.label}>{label}</Text> : null}
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  center: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...tokens.text.headingLg, color: tokens.color.text },
  caption: {
    ...tokens.text.label,
    color: tokens.color.textSubtle,
    marginTop: 2,
  },
});
