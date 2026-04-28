import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Screen } from '../../components/Screen';
import { useAuthStore } from '../../store/auth';
import { apiErrorMessage } from '../../api/client';
import { Auth } from '../../api/endpoints';
import { colors, spacing, type } from '../../theme';
import type { RootStackParamList } from '../../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Otp'>;

export function OtpScreen({ route }: Props) {
  const { phone } = route.params;
  const [otp, setOtp] = React.useState('');
  const [name, setName] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [devOtp, setDevOtp] = React.useState<string | null>(null);
  const signIn = useAuthStore((s) => s.signIn);

  async function onResend() {
    try {
      const r = await Auth.requestOtp(phone);
      if (r.devOtp) setDevOtp(r.devOtp);
    } catch (e) {
      Alert.alert('Error', apiErrorMessage(e));
    }
  }

  async function onVerify() {
    if (otp.length !== 6) return Alert.alert('Invalid OTP', 'Enter the 6-digit code.');
    setLoading(true);
    try {
      await signIn(phone, otp, name || undefined);
    } catch (e) {
      Alert.alert('Verification failed', apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll>
      <Text style={type.h2}>Verify your number</Text>
      <Text style={styles.sub}>We sent a 6-digit code to {phone}</Text>
      <View style={{ height: spacing.lg }} />
      <Input
        label="OTP"
        value={otp}
        onChangeText={setOtp}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="123456"
      />
      <Input
        label="Your name (optional, only on first login)"
        value={name}
        onChangeText={setName}
        placeholder="Priya Mehta"
      />
      <Button title="Verify & continue" onPress={onVerify} loading={loading} />
      <Button title="Resend OTP" onPress={onResend} variant="ghost" style={{ marginTop: spacing.md }} />
      {devOtp ? <Text style={styles.dev}>Dev OTP: {devOtp}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { color: colors.textMuted, marginTop: 6 },
  dev: { textAlign: 'center', color: colors.textMuted, fontSize: 12, marginTop: spacing.lg },
});
