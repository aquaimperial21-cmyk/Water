// The app's safety net. If a screen throws while drawing, or a fatal JS error
// happens anywhere (utils/crashReporter.ts), the customer sees this screen with
// a Restart button instead of the app closing, and the error is reported.

import React from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Updates from 'expo-updates';
import { tokens } from '@theme/tokens';
import { onFatalError, reportAppError } from '../utils/crashReporter';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };
  private unsubscribe?: () => void;

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidMount() {
    this.unsubscribe = onFatalError((error) => this.setState({ error }));
  }

  componentWillUnmount() {
    this.unsubscribe?.();
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    void reportAppError('render', error, { fatal: true, componentStack: info.componentStack ?? undefined });
  }

  private restart = () => {
    // A full reload starts clean; if that isn't possible, try drawing again.
    if (Updates.isEnabled) {
      Updates.reloadAsync().catch(() => this.setState({ error: null }));
    } else {
      this.setState({ error: null });
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: tokens.color.text, textAlign: 'center' }}>
          Something went wrong
        </Text>
        <Text style={{ fontSize: 14, color: tokens.color.textMuted, textAlign: 'center', marginTop: 10, lineHeight: 20 }}>
          We've been told about it automatically. Restart the app to carry on. Your plan and water are not affected.
        </Text>
        <Pressable
          onPress={this.restart}
          accessibilityRole="button"
          style={({ pressed }) => ({
            marginTop: 24,
            backgroundColor: tokens.color.accent,
            paddingVertical: 14,
            paddingHorizontal: 28,
            borderRadius: 14,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>Restart app</Text>
        </Pressable>
      </View>
    );
  }
}
