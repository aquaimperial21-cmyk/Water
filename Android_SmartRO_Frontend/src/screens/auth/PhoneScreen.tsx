import React from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Bubbles } from '../../components/Bubbles';
import { Auth } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { colors, spacing, type, radius, shadow } from '../../theme';
import type { RootStackParamList } from '../../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Phone'>;

export function PhoneScreen({ navigation }: Props) {
  const [phone, setPhone] = React.useState('9876543210');
  const [loading, setLoading] = React.useState(false);
  const [devOtp, setDevOtp] = React.useState<string | null>(null);

  async function onContinue() {
    const e164 = phone.startsWith('+') ? phone : `+91${phone.replace(/\s+/g, '')}`;
    if (!/^\+\d{10,15}$/.test(e164)) {
      Alert.alert('Invalid number', 'Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setLoading(true);
    try {
      const res = await Auth.requestOtp(e164);
      if (res.devOtp) setDevOtp(res.devOtp);
      navigation.navigate('Otp', { phone: e164 });
    } catch (e) {
      Alert.alert('Error', apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Hero with gradient + decorative bubbles */}
        <LinearGradient
          colors={['#0070ea', '#0059bb', '#004493']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Bubbles
            bubbles={[
              { size: 280, top: -80, right: -60, color: '#ffffff', opacity: 0.10 },
              { size: 180, top: 40, left: -50, color: '#ffffff', opacity: 0.08 },
              { size: 110, bottom: -20, right: 40, color: '#56f5f8', opacity: 0.18 },
              { size: 60, top: 120, right: 70, color: '#ffffff', opacity: 0.22 },
            ]}
          />
          <View style={styles.heroContent}>
            <View style={styles.heroIconWrap}>
              <View style={styles.heroIconRing} />
              <View style={styles.heroIcon}>
                <MaterialIcons name="opacity" size={36} color={colors.primary} />
              </View>
            </View>
            <Text style={styles.brand}>SmartRO</Text>
            <Text style={styles.tagline}>Clean water as a service.</Text>
            <View style={styles.bullets}>
              {['No upfront cost', 'Free install', 'All filters covered'].map((b) => (
                <View key={b} style={styles.bullet}>
                  <MaterialIcons name="check-circle" size={14} color={colors.secondaryContainer} />
                  <Text style={styles.bulletText}>{b}</Text>
                </View>
              ))}
            </View>
          </View>
        </LinearGradient>

        {/* Card pulled into hero */}
        <View style={styles.cardWrap}>
          <View style={styles.card}>
            <View style={styles.cardHeadRow}>
              <Text style={[type.headlineMd, { color: colors.onSurface }]}>Welcome</Text>
              <View style={styles.welcomePill}>
                <MaterialIcons name="bolt" size={11} color={colors.primary} />
                <Text style={styles.welcomePillText}>10s sign-up</Text>
              </View>
            </View>
            <Text style={styles.sub}>Enter your mobile number to begin.</Text>
            <View style={{ height: spacing.lg }} />
            <Input
              label="Phone Number"
              prefix="+91"
              value={phone}
              onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, '').slice(0, 10))}
              keyboardType="phone-pad"
              placeholder="00000 00000"
            />
            <Button
              title="Send OTP"
              onPress={onContinue}
              loading={loading}
              iconRight="arrow-forward"
              fullWidth
              style={{ marginTop: spacing.md }}
            />
            {devOtp ? (
              <View style={styles.devHint}>
                <MaterialIcons name="info" size={14} color={colors.primary} />
                <Text style={styles.devHintText}>Dev OTP shown on next screen.</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.terms}>
            By continuing you agree to our <Text style={styles.link}>Terms</Text>{' '}
            &{' '}
            <Text style={styles.link}>Privacy</Text>.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceBright },
  hero: {
    height: 360,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  heroContent: { alignItems: 'center', paddingHorizontal: spacing.margin, marginTop: 24 },
  heroIconWrap: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroIconRing: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.md,
  },
  brand: { ...type.headlineXl, color: colors.onPrimary, fontSize: 44, letterSpacing: -1 },
  tagline: { ...type.bodyLg, color: '#d8e2ff', marginTop: 4 },
  bullets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md, justifyContent: 'center' },
  bullet: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bulletText: { ...type.caption, color: '#d8e2ff', fontSize: 11 },

  cardWrap: {
    flex: 1,
    paddingHorizontal: spacing.margin,
    marginTop: -spacing.xl,
    paddingBottom: spacing.margin,
  },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(193,198,215,0.4)',
    ...shadow.md,
  },
  cardHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  welcomePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,89,187,0.10)',
  },
  welcomePillText: { ...type.labelSm, color: colors.primary, fontSize: 9 },
  sub: { ...type.bodyMd, color: colors.onSurfaceVariant, marginTop: 4 },
  devHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    justifyContent: 'center',
  },
  devHintText: { ...type.caption, color: colors.primary },
  terms: {
    ...type.caption,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  link: { color: colors.primary, fontFamily: 'Manrope_700Bold' },
});
