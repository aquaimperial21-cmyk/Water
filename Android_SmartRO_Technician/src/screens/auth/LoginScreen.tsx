import React from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Button, Input, Screen } from '../../components/UI';
import { useAuthStore } from '../../store/auth';
import { apiErrorMessage } from '../../api/client';
import { colors, spacing, type } from '../../theme';

export function LoginScreen() {
  const [email, setEmail] = React.useState('tech1@smartro.in');
  const [password, setPassword] = React.useState('Tech@12345');
  const [loading, setLoading] = React.useState(false);
  const login = useAuthStore((s) => s.login);

  async function onLogin() {
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      Alert.alert('Login failed', apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.hero}>
          <Text style={styles.brand}>SmartRO</Text>
          <Text style={styles.tagline}>Technician portal</Text>
        </View>
        <View style={{ padding: spacing.xl, flex: 1 }}>
          <Text style={type.h2}>Sign in</Text>
          <Text style={{ color: colors.textMuted, marginTop: 4, marginBottom: spacing.lg }}>
            Use your work email and password.
          </Text>
          <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry />
          <Button title="Sign in" onPress={onLogin} loading={loading} />
          <Text style={styles.hint}>Demo: tech1@smartro.in / Tech@12345</Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.primary, paddingTop: 80, paddingBottom: 60, paddingHorizontal: spacing.xl },
  brand: { color: '#fff', fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  tagline: { color: 'rgba(255,255,255,0.85)', marginTop: 6, fontSize: 14 },
  hint: { textAlign: 'center', color: colors.textMuted, fontSize: 12, marginTop: spacing.lg },
});
