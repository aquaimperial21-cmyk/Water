import React from 'react';
import { Alert, ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CommonActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Booking, Bookings, Kyc } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { colors, radius, spacing, type } from '../../theme';
import { paiseToInr } from '../../utils/format';
import type { RootStackParamList } from '../../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Booking'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

type Step = 'creating' | 'kyc' | 'agreement' | 'paying' | 'done';

export function BookingScreen({ route }: Props) {
  const { productId, planId, cityId } = route.params;
  const navigation = useNavigation<Nav>();

  const [step, setStep] = React.useState<Step>('creating');
  const [booking, setBooking] = React.useState<Booking | null>(null);
  const [aadhaar, setAadhaar] = React.useState('1234');
  const [pan, setPan] = React.useState('ABCDE1234F');
  const [working, setWorking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    Bookings.create({ productId, planId, cityId })
      .then((b) => { if (alive) { setBooking(b); setStep('kyc'); } })
      .catch((e) => { if (alive) setError(apiErrorMessage(e)); });
    return () => { alive = false; };
  }, [productId, planId, cityId]);

  async function submitKyc() {
    if (!/^\d{4}$/.test(aadhaar)) return Alert.alert('Aadhaar', 'Enter the last 4 digits');
    if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(pan.toUpperCase())) return Alert.alert('PAN', 'Format ABCDE1234F');
    setWorking(true);
    try {
      await Kyc.submit({ aadhaarLast4: aadhaar, pan: pan.toUpperCase() });
      setStep('agreement');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setWorking(false);
    }
  }

  async function signAndPay() {
    if (!booking) return;
    setWorking(true);
    try {
      await Bookings.signAgreement(booking.id);
      setStep('paying');
      const r = await Bookings.pay(booking.id);
      setBooking({ ...booking, status: 'INSTALLED' });
      setStep('done');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _ = r;
    } catch (e) {
      setError(apiErrorMessage(e));
      setStep('agreement');
    } finally {
      setWorking(false);
    }
  }

  if (error) {
    return <Screen><Text style={{ color: colors.danger }}>{error}</Text></Screen>;
  }

  if (!booking) {
    return <Screen><ActivityIndicator color={colors.primary} /></Screen>;
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={styles.steps}>
          {(['kyc', 'agreement', 'paying', 'done'] as Step[]).map((s, idx) => (
            <View key={s} style={styles.stepItem}>
              <View style={[styles.stepDot, currentIndex(step) >= idx && styles.stepDotActive]}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{idx + 1}</Text>
              </View>
              <Text style={[styles.stepLabel, currentIndex(step) >= idx && { color: colors.primary, fontWeight: '700' }]}>
                {labelFor(s)}
              </Text>
            </View>
          ))}
        </View>

        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={type.h3}>Order summary</Text>
            <Badge label={booking.status} tone={statusTone(booking.status)} />
          </View>
          <View style={{ height: spacing.sm }} />
          <Row label={`Plan (${booking.plan?.name})`} value={paiseToInr(booking.firstPaymentPaise)} />
          <Row label="Refundable deposit" value={paiseToInr(booking.depositPaise)} />
          <Row label="GST (18%)" value={paiseToInr(Math.round((booking.firstPaymentPaise + booking.depositPaise) * 0.18))} />
          <View style={styles.divider} />
          <Row label="Total today" value={paiseToInr(booking.firstPaymentPaise + booking.depositPaise + Math.round((booking.firstPaymentPaise + booking.depositPaise) * 0.18))} bold />
        </Card>

        {step === 'kyc' && (
          <Card>
            <Text style={type.h3}>KYC details</Text>
            <Text style={{ color: colors.textMuted, marginTop: 4, marginBottom: spacing.md, fontSize: 13 }}>
              Required by RBI. We'll mask Aadhaar and only use it for identity verification.
            </Text>
            <Input label="Aadhaar — last 4 digits" value={aadhaar} onChangeText={setAadhaar} keyboardType="number-pad" maxLength={4} />
            <Input label="PAN" value={pan} onChangeText={(s) => setPan(s.toUpperCase())} autoCapitalize="characters" maxLength={10} />
            <Button title="Submit KYC" onPress={submitKyc} loading={working} />
          </Card>
        )}

        {step === 'agreement' && (
          <Card>
            <Text style={type.h3}>Rental agreement</Text>
            <Text style={{ color: colors.textMuted, marginTop: 4 }}>By tapping "Sign & continue" you agree to:</Text>
            <Text style={styles.li}>• A 6-month minimum lock-in.</Text>
            <Text style={styles.li}>• Recurring monthly payment for the term you selected.</Text>
            <Text style={styles.li}>• Returning the device in working condition at the end of the term.</Text>
            <Text style={styles.li}>• SmartRO providing all maintenance and filter replacements free.</Text>
            <View style={{ height: spacing.md }} />
            <Button title="Sign & continue to payment" onPress={signAndPay} loading={working} />
          </Card>
        )}

        {step === 'paying' && (
          <Card>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ textAlign: 'center', marginTop: spacing.md, color: colors.textMuted }}>
              Processing payment via stub gateway… (TODO PROD: Razorpay)
            </Text>
          </Card>
        )}

        {step === 'done' && (
          <Card style={{ borderColor: colors.success, borderWidth: 1.5 }}>
            <Text style={[type.h2, { color: colors.success }]}>🎉 Payment received</Text>
            <Text style={{ marginTop: 8, color: colors.text }}>
              Your subscription is now ACTIVE. A technician will reach out within 24 hours to schedule installation.
            </Text>
            <View style={{ height: spacing.md }} />
            <Button
              title="Go to My Plan"
              onPress={() =>
                navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Tabs' }] }))
              }
            />
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text style={{ color: bold ? colors.text : colors.textMuted, fontWeight: bold ? '700' : '400' }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: bold ? '800' : '600' }}>{value}</Text>
    </View>
  );
}

function currentIndex(step: Step): number {
  return ({ creating: -1, kyc: 0, agreement: 1, paying: 2, done: 3 } as const)[step];
}
function labelFor(s: Step): string {
  return ({ creating: '', kyc: 'KYC', agreement: 'Sign', paying: 'Pay', done: 'Done' } as const)[s];
}
function statusTone(status: string): 'success' | 'warning' | 'info' | 'neutral' {
  if (status === 'INSTALLED' || status === 'PAID') return 'success';
  if (status === 'PENDING_KYC' || status === 'PENDING_PAY') return 'warning';
  return 'info';
}

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg, paddingHorizontal: spacing.sm },
  stepItem: { alignItems: 'center', flex: 1 },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: colors.primary },
  stepLabel: { fontSize: 11, marginTop: 4, color: colors.textMuted },
  li: { marginTop: 4, color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
});
