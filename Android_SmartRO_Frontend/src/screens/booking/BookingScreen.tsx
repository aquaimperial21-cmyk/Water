import React from 'react';
import { Alert, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { CommonActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Bubbles } from '../../components/Bubbles';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Stepper } from '../../components/Stepper';
import { Booking, Bookings, Kyc } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { colors, radius, spacing, type, shadow } from '../../theme';
import { paiseToInr } from '../../utils/format';
import type { RootStackParamList } from '../../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Booking'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

type Step = 'creating' | 'kyc' | 'agreement' | 'paying' | 'done';

export function BookingScreen({ route, navigation }: Props) {
  const { productId, planId, cityId } = route.params;
  const nav = useNavigation<Nav>();

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
      await Bookings.pay(booking.id);
      setBooking({ ...booking, status: 'INSTALLED' });
      setStep('done');
    } catch (e) {
      setError(apiErrorMessage(e));
      setStep('agreement');
    } finally {
      setWorking(false);
    }
  }

  if (error) {
    return (
      <View style={{ flex: 1, padding: spacing.lg, backgroundColor: colors.surfaceBright }}>
        <Text style={{ color: colors.error, ...type.bodyMd }}>{error}</Text>
        <Button title="Back" onPress={() => navigation.goBack()} variant="ghost" style={{ marginTop: spacing.md }} />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBright }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const subtotal = booking.firstPaymentPaise + booking.depositPaise;
  const gst = Math.round(subtotal * 0.18);
  const stepIndex = currentIndex(step);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceBright }}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={22} color={colors.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Booking</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }} showsVerticalScrollIndicator={false}>
        {/* Stepper */}
        <View style={styles.stepperWrap}>
          <Stepper steps={['KYC', 'Sign', 'Pay', 'Done']} current={stepIndex} />
        </View>

        {/* Order summary */}
        <View style={[styles.summaryCard, shadow.sm]}>
          <Text style={[type.labelMd, { color: colors.onSurfaceVariant, marginBottom: spacing.md }]}>Order Summary</Text>
          <View style={styles.summaryHead}>
            <View style={styles.summaryIcon}>
              <MaterialIcons name="opacity" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyMdSemi, { color: colors.onSurface }]}>{booking.plan?.name ?? 'Selected plan'}</Text>
              <Text style={[type.bodyMd, { color: colors.onSurfaceVariant, fontSize: 13 }]}>SmartRO Purifier</Text>
            </View>
          </View>
          <View style={styles.summaryDivider} />
          <SummaryRow label="Plan cost" value={paiseToInr(booking.firstPaymentPaise)} />
          <SummaryRow label="Refundable deposit" value={paiseToInr(booking.depositPaise)} />
          <SummaryRow label="GST (18%)" value={paiseToInr(gst)} />
          <View style={styles.summaryDivider} />
          <SummaryRow label="Total today" value={paiseToInr(subtotal + gst)} bold />
        </View>

        {/* Step body */}
        {step === 'kyc' && (
          <View style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <View style={styles.stepIconWrap}>
                <MaterialIcons name="badge" size={20} color={colors.primary} />
              </View>
              <Text style={[type.titleLg, { color: colors.onSurface, fontSize: 18 }]}>KYC details</Text>
            </View>
            <Text style={styles.stepHint}>
              Required by RBI. We mask Aadhaar and only use it for identity verification.
            </Text>
            <Input
              label="Aadhaar — last 4 digits"
              value={aadhaar}
              onChangeText={(t) => setAadhaar(t.replace(/[^0-9]/g, '').slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="0000"
            />
            <Input
              label="PAN"
              value={pan}
              onChangeText={(s) => setPan(s.toUpperCase())}
              autoCapitalize="characters"
              maxLength={10}
              placeholder="ABCDE1234F"
            />
            <Button title="Submit KYC" onPress={submitKyc} loading={working} fullWidth iconRight="arrow-forward" />
          </View>
        )}

        {step === 'agreement' && (
          <View style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <View style={styles.stepIconWrap}>
                <MaterialIcons name="draw" size={20} color={colors.primary} />
              </View>
              <Text style={[type.titleLg, { color: colors.onSurface, fontSize: 18 }]}>Rental agreement</Text>
            </View>
            <Text style={styles.stepHint}>By tapping "Sign & continue" you agree to:</Text>
            {[
              '6-month minimum lock-in period',
              'Recurring monthly payment for the term selected',
              'Returning the device in working condition at end of term',
              'SmartRO covers all maintenance and filter replacements',
            ].map((line) => (
              <View key={line} style={styles.bullet}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>{line}</Text>
              </View>
            ))}
            <View style={{ height: spacing.md }} />
            <Button title="Sign & continue to payment" onPress={signAndPay} loading={working} fullWidth iconRight="arrow-forward" />
          </View>
        )}

        {step === 'paying' && (
          <View style={[styles.stepCard, { alignItems: 'center', paddingVertical: spacing.xxl }]}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={[type.titleMd, { color: colors.onSurface, marginTop: spacing.md }]}>Processing payment</Text>
            <Text style={[type.bodyMd, { color: colors.onSurfaceVariant, textAlign: 'center', marginTop: 4 }]}>
              Secure stub gateway. {'\n'}This usually takes 1-2 seconds.
            </Text>
          </View>
        )}

        {step === 'done' && (
          <View style={styles.successCard}>
            <LinearGradient
              colors={[colors.primaryFixed, colors.surfaceContainerLowest]}
              style={styles.successGradient}
            >
              <Bubbles
                bubbles={[
                  { size: 200, top: -60, right: -40, color: colors.primary, opacity: 0.08 },
                  { size: 120, bottom: -30, left: -20, color: colors.secondary, opacity: 0.10 },
                ]}
              />
              <View style={styles.successCircle}>
                <View style={styles.successRing} />
                <View style={styles.successCircleInner}>
                  <MaterialIcons name="check" size={48} color={colors.onPrimary} />
                </View>
              </View>
              <Text style={[type.headlineLg, { color: colors.onSurface, marginTop: spacing.md, fontSize: 26, textAlign: 'center' }]}>
                You're all set! 🎉
              </Text>
              <Text style={[type.bodyMd, { color: colors.onSurfaceVariant, textAlign: 'center', marginTop: 8, paddingHorizontal: spacing.md }]}>
                Your subscription is now active. A technician will reach out within 24 hours to schedule installation.
              </Text>
            </LinearGradient>

            <View style={styles.successFacts}>
              {[
                { icon: 'schedule' as const, label: 'Install in 48h' },
                { icon: 'support-agent' as const, label: '24/7 support' },
                { icon: 'autorenew' as const, label: 'Free filters' },
              ].map((f) => (
                <View key={f.label} style={styles.successFact}>
                  <View style={styles.successFactIcon}>
                    <MaterialIcons name={f.icon} size={16} color={colors.primary} />
                  </View>
                  <Text style={styles.successFactLabel}>{f.label}</Text>
                </View>
              ))}
            </View>

            <View style={{ padding: spacing.lg }}>
              <Button
                title="Go to My Plan"
                fullWidth
                iconRight="arrow-forward"
                onPress={() =>
                  nav.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Tabs' as any }] }))
                }
              />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[bold ? type.bodyMdSemi : type.bodyMd, { color: bold ? colors.onSurface : colors.onSurfaceVariant }]}>
        {label}
      </Text>
      <Text style={[bold ? type.titleMd : type.bodyMdSemi, { color: bold ? colors.primary : colors.onSurface }]}>
        {value}
      </Text>
    </View>
  );
}

function currentIndex(step: Step): number {
  return ({ creating: 0, kyc: 0, agreement: 1, paying: 2, done: 3 } as const)[step];
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...type.titleLg, color: colors.primary, fontSize: 20 },

  stepperWrap: { paddingHorizontal: spacing.sm, marginBottom: spacing.lg },

  summaryCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  summaryHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryDivider: { height: 1, backgroundColor: colors.surfaceVariant, marginVertical: spacing.md },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },

  stepCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(193,198,215,0.4)',
    ...shadow.sm,
  },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.sm },
  stepIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0,89,187,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepHint: { ...type.bodyMd, color: colors.onSurfaceVariant, fontSize: 13, marginBottom: spacing.md },

  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 8 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginTop: 8 },
  bulletText: { flex: 1, ...type.bodyMd, color: colors.onSurface },

  successCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(193,198,215,0.4)',
    ...shadow.sm,
  },
  successGradient: {
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    overflow: 'hidden',
  },
  successCircle: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successRing: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: 'rgba(0,89,187,0.30)',
  },
  successCircleInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.md,
  },
  successFacts: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  successFact: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: radius.md,
    gap: 6,
  },
  successFactIcon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center', justifyContent: 'center',
  },
  successFactLabel: { ...type.labelSm, color: colors.onSurfaceVariant, fontSize: 10, textAlign: 'center' },
});
