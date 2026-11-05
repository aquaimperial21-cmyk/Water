import React from 'react';
import { ScrollView, ScrollViewProps, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { tokens } from '@theme/tokens';
import { motion } from '@theme/motion';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: ReadonlyArray<'top' | 'bottom' | 'left' | 'right'>;
  contentContainerStyle?: ViewStyle;
  scrollProps?: ScrollViewProps;
  background?: 'bg' | 'surface';
  /** disable the entry animation (e.g. for screens with their own choreography) */
  noAnimate?: boolean;
};

export function Screen({
  children,
  scroll = true,
  edges = ['top', 'bottom', 'left', 'right'],
  contentContainerStyle,
  scrollProps,
  background = 'bg',
  noAnimate,
}: Props) {
  const bg = background === 'bg' ? tokens.color.bg : tokens.color.surface;
  const inner = noAnimate ? (
    <View style={{ flex: 1 }}>{children}</View>
  ) : (
    <MotiView style={{ flex: 1 }} {...motion.fadeRise}>
      {children}
    </MotiView>
  );

  if (!scroll) {
    return (
      <SafeAreaView edges={edges} style={[styles.safe, { backgroundColor: bg }]}>
        {inner}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={edges} style={[styles.safe, { backgroundColor: bg }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, contentContainerStyle]}
        {...scrollProps}
      >
        {inner}
      </ScrollView>
    </SafeAreaView>
  );
}

export function ScreenSection({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.section, style]}>{children}</View>;
}

export function ScreenHeader({
  title,
  eyebrow,
  trailing,
  style,
}: {
  title: string;
  eyebrow?: string;
  trailing?: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[headerStyles.row, style]}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={headerStyles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={headerStyles.title}>{title}</Text>
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingHorizontal: tokens.space['5'],
    paddingTop: tokens.space['2'],
    paddingBottom: tokens.space['16'],
  },
  section: { marginTop: tokens.space['8'] },
});

const headerStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: tokens.space['3'],
    marginBottom: tokens.space['4'],
  },
  eyebrow: {
    ...tokens.text.label,
    color: tokens.color.textSubtle,
    marginBottom: 4,
  },
  title: {
    ...tokens.text.headingLg,
    color: tokens.color.text,
  },
});
