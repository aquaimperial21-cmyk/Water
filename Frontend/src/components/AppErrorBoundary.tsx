// The app's safety net. If a screen throws while drawing, or a fatal JS error
// happens anywhere (utils/crashReporter.ts), the customer sees this screen with
// a Restart button instead of the app closing, and the error is reported.

import React from 'react';
import { InteractionManager, Pressable, Text, View } from 'react-native';
import * as Updates from 'expo-updates';
import { tokens } from '@theme/tokens';
import { flushReports, onFatalError, reportAppError } from '../utils/crashReporter';

/**
 * Waits, at most 3 s, for the reports still on their way (the one about what
 * broke, usually). Any not sent by then are sent on the next launch.
 */
function waitForReports(): Promise<void> {
  return Promise.race([flushReports(), new Promise<void>((resolve) => setTimeout(resolve, 3000))]);
}

/**
 * Restarts the app (into a downloaded update, if there is one) once the
 * screen has settled: reloading while a dialog is still closing, or while a
 * push is being handled, can crash the app natively. Rejects if the app
 * could not reload.
 */
export async function restartApp(): Promise<void> {
  // runAfterInteractions waits out gestures and Animated animations; the
  // 500 ms covers Reanimated ones (the dialog, the pressed button, a toast).
  // Capped, as a looping animation would hold it up forever.
  await new Promise<void>((resolve) => {
    InteractionManager.runAfterInteractions(() => setTimeout(resolve, 500));
    setTimeout(resolve, 2000);
  });
  await Updates.reloadAsync();
}

type Props = { children: React.ReactNode };
type State = { error: Error | null; restarting: boolean };

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, restarting: false };
  private unsubscribe?: () => void;

  static getDerivedStateFromError(error: Error): Partial<State> {
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
    if (this.state.restarting) return;
    // A full reload starts clean; if that isn't possible, try drawing again.
    // The report of what broke gets to finish first.
    if (Updates.isEnabled) {
      this.setState({ restarting: true });
      waitForReports()
        .then(() => restartApp())
        .catch((e) => {
          void reportAppError('updates', e);
          this.setState({ error: null, restarting: false });
        });
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
          disabled={this.state.restarting}
          accessibilityRole="button"
          accessibilityState={{ busy: this.state.restarting }}
          style={({ pressed }) => ({
            marginTop: 24,
            backgroundColor: tokens.color.accent,
            paddingVertical: 14,
            paddingHorizontal: 28,
            borderRadius: 14,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>
            {this.state.restarting ? 'Restarting…' : 'Restart app'}
          </Text>
        </Pressable>
      </View>
    );
  }
}
