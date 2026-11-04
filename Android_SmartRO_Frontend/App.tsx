import 'react-native-gesture-handler';
// First, before any other app module runs: catch and report errors.
import './src/utils/installCrashHandlers';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Manrope_400Regular,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { RootNavigator } from './src/navigation';
import { MessageHost } from './src/components/ui/MessageHost';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';
import { reportAppError, reportUpdateProblems } from './src/utils/crashReporter';
import { tokens } from './src/theme';

export default function App() {
  // An update that crashed at launch (and was rolled back) gets reported.
  React.useEffect(() => {
    void reportUpdateProblems();
  }, []);

  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  // A font that fails to load must not keep the app on the spinner: carry on
  // with the system font and report it.
  React.useEffect(() => {
    if (fontError) void reportAppError('promise', fontError);
  }, [fontError]);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={tokens.color.accent} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <AppErrorBoundary>
          <RootNavigator />
          <MessageHost />
        </AppErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
