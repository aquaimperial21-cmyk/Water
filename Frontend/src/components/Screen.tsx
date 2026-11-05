import React from 'react';
import { ScrollView, View, StyleSheet, ViewStyle, ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

type ScreenProps = ScrollViewProps & {
  children: React.ReactNode;
  contentStyle?: ViewStyle;
  padded?: boolean;
  scroll?: boolean;
  bg?: string;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
};

export function Screen({
  children,
  contentStyle,
  padded = false,
  scroll = true,
  bg = colors.surfaceBright,
  edges = ['top', 'bottom'],
  ...rest
}: ScreenProps) {
  const innerPadStyle = padded ? { padding: spacing.margin } : null;
  if (scroll) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={edges}>
        <ScrollView
          style={{ flex: 1, backgroundColor: bg }}
          contentContainerStyle={[innerPadStyle, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          {...rest}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={edges}>
      <View style={[{ flex: 1, backgroundColor: bg }, innerPadStyle, contentStyle as ViewStyle]}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
