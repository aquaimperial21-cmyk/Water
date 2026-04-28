import React from 'react';
import { ScrollView, StyleSheet, View, ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

interface Props extends ViewProps {
  scroll?: boolean;
  padded?: boolean;
}

export function Screen({ children, scroll, padded = true, style }: Props) {
  const Container: any = scroll ? ScrollView : View;
  const containerStyle = scroll
    ? { contentContainerStyle: [padded && styles.padded, style] }
    : { style: [styles.root, padded && styles.padded, style] };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Container {...containerStyle} keyboardShouldPersistTaps={scroll ? 'handled' : undefined}>
        {scroll ? <View style={[styles.root, padded && styles.padded]}>{children}</View> : children}
      </Container>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  root: { flex: 1, backgroundColor: colors.bg },
  padded: { padding: spacing.lg },
});
