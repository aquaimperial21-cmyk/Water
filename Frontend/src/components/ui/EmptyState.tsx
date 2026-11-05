import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { MotiView } from 'moti';
import { Check } from 'lucide-react-native';
import { tokens } from '@theme/tokens';
import { WaterDrop } from './WaterDrop';

type Props = {
  illustration?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  secondary?: React.ReactNode;
  /** When set, renders the success-tinted halo set instead of the cyan drop. */
  variant?: 'drop' | 'check';
  style?: ViewStyle;
};

export function EmptyState({
  illustration,
  title,
  description,
  action,
  secondary,
  variant = 'drop',
  style,
}: Props) {
  const isCheck = variant === 'check';
  const haloBase = isCheck ? 'rgba(39,176,125,0.20)' : 'rgba(35,186,251,0.20)';
  const haloPulse = isCheck ? 'rgba(39,176,125,0.30)' : 'rgba(35,186,251,0.30)';
  const haloInner = isCheck ? 'rgba(39,176,125,0.15)' : 'rgba(35,186,251,0.15)';

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.illustration}>
        {/* Inner static halo */}
        <View style={[styles.halo, { backgroundColor: haloBase }]} />
        {/* Pulsing ring */}
        <MotiView
          from={{ scale: 1, opacity: 0.55 }}
          animate={{ scale: 2, opacity: 0 }}
          transition={{ type: 'timing', duration: 2000, loop: true }}
          style={[styles.halo, { backgroundColor: haloPulse }]}
        />
        {/* Mid halo */}
        <View style={[styles.haloMid, { backgroundColor: haloInner }]} />
        <View style={styles.illuInner}>
          {illustration ?? (isCheck ? (
            <View style={styles.checkDisk}>
              <Check size={24} color="#FFFFFF" strokeWidth={3} />
            </View>
          ) : (
            <WaterDrop size={42} />
          ))}
        </View>
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.desc}>{description}</Text> : null}
      {action ? <View style={{ marginTop: tokens.space['5'] }}>{action}</View> : null}
      {secondary ? <View style={{ marginTop: tokens.space['3'] }}>{secondary}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: tokens.space['10'],
    paddingHorizontal: tokens.space['6'],
  },
  illustration: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  halo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 48,
  },
  haloMid: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
    borderRadius: 40,
  },
  illuInner: { alignItems: 'center', justifyContent: 'center' },
  checkDisk: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tokens.color.success,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: tokens.color.success,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  title: { ...tokens.text.titleMd, color: tokens.color.text, textAlign: 'center' },
  desc: {
    ...tokens.text.bodySm,
    color: tokens.color.textMuted,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 320,
  },
});
