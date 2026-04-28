import React from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Screen } from '../../components/Screen';
import { Auth } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { colors, spacing, type } from '../../theme';
import type { RootStackParamList } from '../../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Phone'>;

export function PhoneScreen({ navigation }: Props) {
  const [phone, setPhone] = React.useState('+919876543210');
  const [loading, setLoading] = React.useState(false);
  const [devOtp, setDevOtp] = React.useState<string | null>(null);

  async function onContinue() {
    if (!/^\+?\d{10,15}$/.test(phone)) {
      Alert.alert('Invalid phone', 'Enter a valid mobile number with country code (e.g. +91...).');
      return;
    }
    setLoading(true);
    try {
      const res = await Auth.requestOtp(phone);
      if (res.devOtp) setDevOtp(res.devOtp);
      navigation.navigate('Otp', { phone });
    } catch (e) {
      Alert.alert('Error', apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.hero}>
          <Text style={styles.brand}>SmartRO</Text>
          <Text style={styles.tagline}>Clean water as a service.</Text>
        </View>
        <View style={styles.body}>
          <Text style={type.h2}>Welcome</Text>
          <Text style={styles.sub}>Enter your phone number to continue. We'll send you a one-time code.</Text>
          <View style={{ height: spacing.lg }} />
          <Input
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoCapitalize="none"
            placeholder="+91XXXXXXXXXX"
          />
          <Button title="Send OTP" onPress={onContinue} loading={loading} />
          {devOtp ? (
            <Text style={styles.devHint}>Dev OTP: {devOtp}</Text>
          ) : (
            <Text style={styles.devHint}>Try +919876543210 (Priya — has active subscription)</Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: {
    backgroundColor: colors.primary,
    paddingTop: 80,
    paddingBottom: 60,
    paddingHorizontal: spacing.xl,
  },
  brand: { color: '#fff', fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  tagline: { color: 'rgba(255,255,255,0.85)', marginTop: 6, fontSize: 14 },
  body: { padding: spacing.xl, flex: 1 },
  sub: { color: colors.textMuted, marginTop: 6, fontSize: 14 },
  devHint: { textAlign: 'center', color: colors.textMuted, fontSize: 12, marginTop: spacing.lg },
});
