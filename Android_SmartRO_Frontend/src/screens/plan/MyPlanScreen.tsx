import React from 'react';
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { AxiosError } from 'axios';
import { confirmAction, showDialog, toast } from '../../utils/messages';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Beaker,
  Calendar,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CreditCard,
  Info,
  LifeBuoy,
  Lock,
  Power,
  RefreshCw,
  ShoppingBag,
  TriangleAlert,
  Undo2,
  Wrench,
  Zap,
} from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Catalog,
  Invoice,
  Invoices,
  Payments,
  PlanCityPrice,
  Subscription,
  Subscriptions,
  Ticket,
  Tickets,
} from '../../api/endpoints';
import { tokens } from '@theme/tokens';
import { Aurora, Button, Chip, EmptyState, Pill, ProgressRing, Skeleton } from '@ui/index';
import { formatAgo, formatDate, paiseToInr } from '../../utils/format';
import { apiErrorMessage } from '../../api/client';
import { PaymentCancelledError, PaymentFailedError, payRecharge } from '../../utils/payments';
import { cycleLabel, termLength, termPricePaise } from '../../utils/plans';
import {
  pastPlanSummary,
  pickDefaultSubscription,
  planMonths,
  planView,
  rechargeEndDate,
  type PlanRowIcon,
  type PlanView,
} from '../../utils/planState';
import type { RootStackParamList } from '../../navigation';
import { getCachedAccess, refreshPurifier } from '../../utils/localPurifier';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type TimelineItem = {
  id: string;
  date: string;
  title: string;
  meta: string;
  state: 'done' | 'upcoming' | 'inProgress';
};

const TICKET_TITLE: Record<string, string> = {
  FILTER: 'Filter / water-quality check',
  INSTALL: 'Installation',
  SERVICE: 'Service visit',
  REPAIR: 'Repair',
  BILLING: 'Billing query',
  DELIVERY: 'Delivery',
  OTHER: 'Support request',
};

/** Real service history: the customer's own tickets, newest first. */
function ticketsToTimeline(tickets: Ticket[]): TimelineItem[] {
  return tickets.slice(0, 6).map((t) => ({
    id: t.id,
    date: t.createdAt,
    title: TICKET_TITLE[t.category] ?? 'Service request',
    meta: t.status.replace(/_/g, ' ').toLowerCase(),
    state: t.status === 'RESOLVED' || t.status === 'CLOSED' ? 'done' : 'inProgress',
  }));
}

function apiError(e: unknown): { status?: number; code?: string } {
  const res = (e as AxiosError<{ error?: { code?: string } }> | undefined)?.response;
  return { status: res?.status, code: res?.data?.error?.code };
}

const priceKey = (productId: string, cityId: string) => `${productId}:${cityId}`;

const AUTOPAY_UNAVAILABLE = 'Autopay is not available yet. Recharge manually before your plan ends.';

type BusyKey = 'recharge' | 'autopay' | 'cancel' | 'waterTest';

export function MyPlanScreen() {
  const navigation = useNavigation<Nav>();
  const [subs, setSubs] = React.useState<Subscription[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [pricing, setPricing] = React.useState<Record<string, PlanCityPrice[]>>({});
  const [driver, setDriver] = React.useState<'stub' | 'razorpay' | null>(null);
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [timeline, setTimeline] = React.useState<TimelineItem[]>([]);
  const [refreshing, setRefreshing] = React.useState(false);
  const [busy, setBusy] = React.useState<BusyKey | null>(null);
  const [showPast, setShowPast] = React.useState(false);
  // The water switch talks to the purifier over Wi-Fi, so it still works when this screen can't load.
  const [hasLocalSwitch, setHasLocalSwitch] = React.useState(false);
  const [now, setNow] = React.useState(() => new Date());
  const subsRef = React.useRef<Subscription[] | null>(null);
  // Held from the first tap (confirm dialog included) until the action ends,
  // so a double tap can't queue a second dialog or a second request.
  const lockRef = React.useRef(false);

  const load = React.useCallback(async () => {
    setRefreshing(true);
    setNow(new Date());
    try {
      const list = await Subscriptions.mine();
      subsRef.current = list;
      setSubs(list);
      setLoadError(null);
      // Current monthly price per product + city: the recharge amount, and the
      // price shown on the card even after a plan switch.
      const wanted = new Map<string, { productId: string; cityId: string }>();
      list.forEach((s) => {
        if (s.status !== 'CLOSED' && s.booking?.cityId) {
          wanted.set(priceKey(s.productId, s.booking.cityId), { productId: s.productId, cityId: s.booking.cityId });
        }
      });
      wanted.forEach(({ productId, cityId }, key) => {
        Catalog.pricing(productId, cityId)
          .then((prices) => setPricing((p) => ({ ...p, [key]: prices })))
          .catch(() => {});
      });
    } catch (e) {
      const message = apiErrorMessage(e);
      setLoadError(message);
      if (subsRef.current) toast.error('Could not refresh your plan', message);
      void getCachedAccess().then((a) => setHasLocalSwitch(!!a));
    } finally {
      setRefreshing(false);
    }
    // Secondary: a failure hides these rather than blocking the plan itself.
    Payments.config().then((c) => setDriver(c.driver)).catch(() => {});
    Invoices.mine().then(setInvoices).catch(() => setInvoices([]));
    Tickets.mine().then((t) => setTimeline(ticketsToTimeline(t))).catch(() => setTimeline([]));
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      void load();
      // Days/hours left and the expired switch move with the clock.
      const tick = setInterval(() => setNow(new Date()), 60_000);
      return () => clearInterval(tick);
    }, [load])
  );

  const selected = React.useMemo(() => {
    if (!subs) return null;
    const chosen = subs.find((s) => s.id === selectedId);
    // A plan the customer just cancelled moves to "Past plans" while others are still open.
    const keep = chosen && (chosen.status !== 'CLOSED' || subs.every((s) => s.status === 'CLOSED'));
    return keep ? chosen : pickDefaultSubscription(subs, now);
  }, [subs, selectedId, now]);
  const view = React.useMemo(
    () =>
      selected
        ? planView(selected, now, { autopayAvailable: driver === null ? null : driver === 'razorpay' })
        : null,
    [selected, now, driver]
  );
  const openSubs = React.useMemo(() => (subs ?? []).filter((s) => s.status !== 'CLOSED'), [subs]);
  const pastSubs = React.useMemo(
    () => (subs ?? []).filter((s) => s.status === 'CLOSED' && s.id !== selected?.id),
    [subs, selected]
  );

  /** Today's listed monthly price for this subscription's plan, or null if unknown. */
  const listedMonthly = React.useCallback(
    (sub: Subscription): number | null => {
      const cityId = sub.booking?.cityId;
      const prices = cityId ? pricing[priceKey(sub.productId, cityId)] : undefined;
      return prices?.find((p) => p.planId === sub.planId)?.monthlyPricePaise ?? null;
    },
    [pricing]
  );

  // Oldest to newest, last six — the chart reads left to right.
  const bills = React.useMemo(
    () =>
      [...invoices]
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .slice(-6)
        .map((inv) => ({
          id: inv.id,
          amount: inv.amountPaise,
          month: new Date(inv.createdAt).toLocaleDateString('en-IN', { month: 'short' }),
        })),
    [invoices]
  );

  const act = React.useCallback(async (key: BusyKey, fn: (start: () => void) => Promise<void>) => {
    if (lockRef.current) return;
    lockRef.current = true;
    try {
      await fn(() => setBusy(key));
    } finally {
      lockRef.current = false;
      setBusy(null);
    }
  }, []);

  const onRecharge = React.useCallback(
    (sub: Subscription) =>
      act('recharge', async (start) => {
        const at = new Date();
        const months = planMonths(sub);
        const monthly = listedMonthly(sub);
        const amount = monthly === null ? null : termPricePaise(monthly, months);
        const amountText = amount === null ? 'the plan amount' : paiseToInr(amount);
        const newEnd = rechargeEndDate(sub, at);
        const running = new Date(sub.expiresAt).getTime() > at.getTime();
        const parts = [
          `${amount === null ? 'Price shown at checkout' : paiseToInr(amount)} for ${termLength(months)} · new end date ${formatDate(newEnd)}`,
        ];
        if (!running) parts.push('Water comes back on as soon as the payment is confirmed.');
        if (running && sub.autopayStatus === 'ACTIVE') {
          parts.push(
            `Autopay is on, so it will also debit ${amountText} on your renewal date (${formatDate(sub.expiresAt)}). Turn autopay off first if you only want to pay once.`
          );
        }
        const ok = await confirmAction({
          title: 'Recharge plan',
          message: parts.join('\n\n'),
          confirmLabel: amount === null ? 'Recharge' : `Pay ${paiseToInr(amount)}`,
        });
        if (!ok) return;
        start();
        try {
          const outcome = await payRecharge(sub.id, `${sub.plan?.name ?? 'Plan'} recharge`);
          // Settled on the server: ask the purifier on this Wi-Fi to pick it up now.
          if (outcome === 'paid') void refreshPurifier();
          await load();
          if (outcome === 'pending') {
            void showDialog({
              title: 'Payment received',
              message: 'We are confirming it with your bank. Your new end date shows within a few minutes.',
            });
          } else {
            toast.success('Recharged', `Your plan now runs until ${formatDate(newEnd)}.`);
          }
        } catch (e) {
          if (e instanceof PaymentCancelledError) {
            toast.info('Payment cancelled', 'If you finished paying in your UPI app, your plan updates here within a few minutes.');
          } else if (e instanceof PaymentFailedError) {
            void showDialog({
              title: 'Payment failed',
              message: e.maybeCharged ? e.message : `${e.message}\n\nYou have not been charged.`,
            });
          } else {
            // Thrown before Checkout takes any money (config, order, stub recharge).
            toast.error('Recharge failed', apiErrorMessage(e));
          }
        }
      }),
    [act, listedMonthly, load]
  );

  const onCancel = React.useCallback(
    (sub: Subscription, v: PlanView) =>
      act('cancel', async (start) => {
        const c = v.actions.cancel;
        if (!c.enabled || (c.mode !== 'trial' && c.mode !== 'postLockIn')) return;
        const refund = paiseToInr(c.refundPaise);
        const mandateLive =
          !!sub.autopayStatus && ['CREATED', 'ACTIVE', 'PAUSED', 'PENDING'].includes(sub.autopayStatus);
        const ok = await confirmAction({
          title: 'Cancel subscription',
          message:
            (c.mode === 'trial'
              ? `You're inside the 7-day trial, so we refund everything you paid: ${refund} (deposit + first payment). We then collect the purifier.`
              : `We refund your ${refund} deposit within 5–7 working days, after collecting and checking the purifier.`) +
            (mandateLive ? '\n\nYour autopay is stopped too.' : ''),
          confirmLabel: 'Cancel plan',
          cancelLabel: 'Keep plan',
          destructive: true,
        });
        if (!ok) return;
        start();
        try {
          const r = await Subscriptions.cancel(sub.id, c.mode === 'trial' ? 'TRIAL_CANCEL' : 'POST_LOCKIN_CANCEL');
          // Closed on the server: ask the purifier on this Wi-Fi to switch off now.
          void refreshPurifier();
          toast.success(
            'Plan cancelled',
            r.refundPaise > 0
              ? `Refund of ${paiseToInr(r.refundPaise)} will be processed in 5–7 working days.`
              : 'Your plan is closed.'
          );
        } catch (e) {
          if (apiError(e).status === 403) {
            toast.warning('Locked-in', `This plan is locked in until ${formatDate(sub.lockInUntil)}.`);
          } else {
            toast.error('Cancellation failed', apiErrorMessage(e));
          }
        }
        await load();
      }),
    [act, load]
  );

  const onAutopay = React.useCallback(
    (sub: Subscription, v: PlanView) =>
      act('autopay', async (start) => {
        const ap = v.actions.autopay;
        if (!ap.enabled || !ap.op) return;

        if (ap.op === 'cancel') {
          const ok = await confirmAction({
            title: 'Turn off autopay',
            message: `Stop automatic renewal debits? You'll need to recharge before ${formatDate(sub.expiresAt)} to keep water flowing.`,
            confirmLabel: 'Turn off',
            cancelLabel: 'Keep autopay',
            destructive: true,
          });
          if (!ok) return;
          start();
          try {
            await Payments.autopay.cancel(sub.id);
            toast.success('Autopay off', 'Automatic debits stopped. Recharge manually next cycle.');
          } catch (e) {
            toast.error('Could not turn off autopay', apiErrorMessage(e));
          }
          await load();
          return;
        }

        // create — also replaces a CREATED or on-hold mandate (the server cancels the old one).
        const months = planMonths(sub);
        const monthly = listedMonthly(sub);
        const amount = monthly === null ? null : termPricePaise(monthly, months);
        const ok = await confirmAction({
          title: sub.autopayStatus === 'CREATED' ? 'Finish autopay setup' : 'Set up autopay',
          message: `${amount === null ? 'Your plan amount' : paiseToInr(amount)} is debited ${cycleLabel(months)} so your water never stops. You authorise the mandate on Razorpay next, and can turn it off here any time.`,
          confirmLabel: 'Continue',
        });
        if (!ok) return;
        start();
        try {
          const r = await Payments.autopay.create(sub.id);
          if (r.alreadyActive === true) {
            toast.info('Autopay is already on');
          } else if (!r.shortUrl) {
            toast.error('Autopay setup', 'Authorisation link not available. Try again.');
          } else {
            await Linking.openURL(r.shortUrl);
            toast.info(
              'Authorise on Razorpay',
              r.firstDebitAt
                ? `Your first debit is on ${formatDate(r.firstDebitAt)}.`
                : 'The first debit happens as soon as you authorise.'
            );
          }
        } catch (e) {
          if (apiError(e).code === 'RAZORPAY_DISABLED') {
            setDriver('stub');
            toast.info('Autopay unavailable', AUTOPAY_UNAVAILABLE);
          } else {
            toast.error('Could not set up autopay', apiErrorMessage(e));
          }
        }
        await load();
      }),
    [act, listedMonthly, load]
  );

  const onWaterTest = React.useCallback(
    (sub: Subscription) =>
      act('waterTest', async (start) => {
        start();
        try {
          await Tickets.create({
            subscriptionId: sub.id,
            category: 'FILTER',
            description: 'Quick filter / water-quality check requested from My Plan.',
          });
          toast.success('Request raised', 'A technician will reach out shortly.');
          Tickets.mine().then((t) => setTimeline(ticketsToTimeline(t))).catch(() => {});
        } catch (e) {
          toast.error('Could not raise request', apiErrorMessage(e));
        }
      }),
    [act]
  );

  // My Plan lives in the tab navigator; the purifier gallery is on Home.
  const onBrowse = React.useCallback(
    () => (navigation as unknown as { navigate: (name: 'Home') => void }).navigate('Home'),
    [navigation]
  );

  const chipLabel = (s: Subscription) => {
    const name = s.product?.name ?? 'Purifier';
    const twins = openSubs.filter((o) => (o.product?.name ?? 'Purifier') === name).length;
    // Same product twice: name the purifier, or say there isn't one yet.
    return twins > 1 ? `${name} · ${s.device?.serial ?? `not installed (${s.id.slice(-4).toUpperCase()})`}` : name;
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Aurora height={420} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={load}
            tintColor={tokens.color.accent}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Subscription</Text>
          <Text style={styles.heading}>My Plan</Text>
        </View>

        {!subs ? (
          loadError ? (
            <View style={styles.errorCard}>
              <TriangleAlert size={22} color={tokens.color.danger} />
              <Text style={styles.errorTitle}>Couldn't load your plan</Text>
              <Text style={styles.errorBody}>{loadError}</Text>
              <Button
                title="Retry"
                onPress={() => void load()}
                loading={refreshing}
                iconLeft={<RefreshCw size={14} color="#FFFFFF" />}
                style={{ marginTop: 16 }}
              />
              {hasLocalSwitch ? (
                <Button
                  title="Water switch"
                  variant="outline"
                  onPress={() => navigation.navigate('DeviceHealth')}
                  iconLeft={<Power size={14} color={tokens.color.text} />}
                  style={{ marginTop: 10 }}
                />
              ) : null}
            </View>
          ) : (
            <View style={{ marginTop: 24 }}>
              <Skeleton height={220} radius={28} />
            </View>
          )
        ) : !selected || !view ? (
          <View style={{ marginTop: 60 }}>
            <EmptyState
              title="No plan yet"
              description="Browse purifiers and pick the rental plan that fits."
              action={
                <Button
                  title="Browse purifiers"
                  onPress={onBrowse}
                  iconLeft={<ShoppingBag size={14} color="#FFFFFF" />}
                />
              }
            />
          </View>
        ) : (
          <>
            {openSubs.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 16 }}
                contentContainerStyle={{ gap: 8 }}
              >
                {openSubs.map((s) => (
                  <Chip
                    key={s.id}
                    label={chipLabel(s)}
                    selected={s.id === selected.id}
                    onPress={busy ? undefined : () => setSelectedId(s.id)}
                  />
                ))}
              </ScrollView>
            ) : null}

            <StatusCard
              sub={selected}
              view={view}
              monthlyPaise={listedMonthly(selected) ?? bookingMonthly(selected)}
              busy={busy}
              onRecharge={() => void onRecharge(selected)}
              onAutopay={() => void onAutopay(selected, view)}
              onCancel={() => void onCancel(selected, view)}
              onInstallSlot={() =>
                selected.booking && navigation.navigate('InstallSlot', { bookingId: selected.booking.id })
              }
              onSmartHealth={() => navigation.navigate('DeviceHealth')}
              onSupport={() => navigation.navigate('NewTicket', { subscriptionId: selected.id })}
              onBrowse={onBrowse}
            />

            {pastSubs.length > 0 ? (
              <View style={styles.pastCard}>
                <Pressable
                  onPress={() => setShowPast((v) => !v)}
                  style={styles.pastHead}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showPast }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eyebrowMuted}>History</Text>
                    <Text style={styles.pastHeading}>Past plans ({pastSubs.length})</Text>
                  </View>
                  {showPast ? (
                    <ChevronUp size={18} color={tokens.color.textMuted} />
                  ) : (
                    <ChevronDown size={18} color={tokens.color.textMuted} />
                  )}
                </Pressable>
                {showPast
                  ? pastSubs.map((s) => {
                      const p = pastPlanSummary(s);
                      return (
                        <View key={s.id} style={styles.pastRow}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.pastTitle} numberOfLines={1}>{p.title}</Text>
                            <Text style={styles.pastMeta}>{p.ended}</Text>
                            {p.warning ? <Text style={styles.pastWarn}>{p.warning}</Text> : null}
                          </View>
                          {p.refund ? (
                            <Pill tone={p.refundDone ? 'success' : 'warning'} size="sm">{p.refund}</Pill>
                          ) : null}
                        </View>
                      );
                    })
                  : null}
              </View>
            ) : null}
          </>
        )}

        {/* Timeline — only what actually happened on this account */}
        {timeline.length > 0 && (
        <View style={{ marginTop: 32 }}>
          <View style={styles.sectionHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrowMuted}>Service history</Text>
              <Text style={styles.sectionTitle}>Timeline</Text>
            </View>
          </View>

          <View style={styles.timelineWrap}>
            <View style={styles.timelineLine} />
            {timeline.map((t) => (
              <View key={t.id} style={styles.timelineItem}>
                <View
                  style={[
                    styles.timelineDot,
                    t.state === 'done' && {
                      backgroundColor: tokens.color.success,
                      borderColor: tokens.color.success,
                    },
                    t.state === 'inProgress' && {
                      backgroundColor: tokens.color.accent,
                      borderColor: tokens.color.accent,
                    },
                    t.state === 'upcoming' && {
                      backgroundColor: tokens.color.surface,
                      borderColor: tokens.color.accent,
                    },
                  ]}
                >
                  {t.state === 'done' ? (
                    <Check size={10} color="#FFFFFF" strokeWidth={3} />
                  ) : t.state === 'upcoming' ? (
                    <View style={styles.timelineDotInner} />
                  ) : null}
                </View>
                <View style={styles.timelineCard}>
                  <View style={styles.timelineHead}>
                    <Text style={styles.timelineTitle}>{t.title}</Text>
                    {t.state === 'upcoming' ? (
                      <Pill tone="accent" size="sm">Upcoming</Pill>
                    ) : null}
                  </View>
                  <View style={styles.timelineMetaRow}>
                    <Text style={styles.timelineMeta}>{t.meta}</Text>
                    <Text style={styles.timelineDate}>{formatDate(t.date)}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
        )}

        {/* Bills — real invoices only; hidden until the account has one */}
        {bills.length > 0 && (
        <View style={styles.billsCard}>
          <View style={styles.sectionHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrowMuted}>Recent</Text>
              <Text style={styles.sectionTitle}>Bill history</Text>
            </View>
          </View>

          <View style={styles.billsRow}>
            {bills.map((b) => {
              const max = Math.max(...bills.map((x) => x.amount));
              const h = max > 0 ? (b.amount / max) * 100 : 0;
              return (
                <View key={b.id} style={styles.billCol}>
                  <Text style={styles.billAmount}>{paiseToInr(b.amount)}</Text>
                  <View style={styles.billBarTrack}>
                    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                      <LinearGradient
                        colors={[tokens.color.accentGlow, tokens.color.accent]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={[styles.billBarFill, { height: `${h}%` }]}
                      />
                    </View>
                  </View>
                  <Text style={styles.billMonth}>{b.month}</Text>
                </View>
              );
            })}
          </View>
        </View>
        )}

        {/* Side door — water test, only while water is flowing */}
        {selected && view?.actions.waterTest.visible ? (
          <Pressable
            onPress={() => void onWaterTest(selected)}
            disabled={busy !== null}
            style={({ pressed }) => [
              styles.sideDoor,
              pressed && { opacity: 0.95 },
              busy !== null && { opacity: 0.6 },
            ]}
          >
            <View style={styles.sideDoorIcon}>
              <Beaker size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sideDoorTitle}>
                {busy === 'waterTest' ? 'Raising request…' : view.actions.waterTest.label}
              </Text>
              <Text style={styles.sideDoorSub}>We come to you. No charge, ever.</Text>
            </View>
            <ChevronRight size={18} color={tokens.color.accentInk} />
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Fallback price while today's pricing hasn't loaded: the booking was priced
 * for one whole term, so divide it back to a month — but only while the
 * booking still describes this plan (after a switch it would be wrong).
 */
function bookingMonthly(sub: Subscription): number | null {
  const b = sub.booking;
  if (!b || b.planId !== sub.planId) return null;
  return Math.round((b.firstPaymentPaise + (b.referralCreditPaise ?? 0)) / planMonths(sub));
}

const ROW_ICON: Record<PlanRowIcon, (color: string) => React.ReactNode> = {
  renew: (c) => <Zap size={14} color={c} />,
  end: (c) => <Calendar size={14} color={c} />,
  lock: (c) => <Lock size={14} color={c} />,
  visit: (c) => <Wrench size={14} color={c} />,
  refund: (c) => <Undo2 size={14} color={c} />,
};

type ActionButtonSpec = {
  key: string;
  busyKey: BusyKey | null;
  label: string;
  icon: (color: string) => React.ReactNode;
  enabled: boolean;
  onPress: () => void;
};

function StatusCard({
  sub,
  view,
  monthlyPaise,
  busy,
  onRecharge,
  onAutopay,
  onCancel,
  onInstallSlot,
  onSmartHealth,
  onSupport,
  onBrowse,
}: {
  sub: Subscription;
  view: PlanView;
  monthlyPaise: number | null;
  busy: BusyKey | null;
  onRecharge: () => void;
  onAutopay: () => void;
  onCancel: () => void;
  onInstallSlot: () => void;
  onSmartHealth: () => void;
  onSupport: () => void;
  onBrowse: () => void;
}) {
  const { actions, kind } = view;
  const productName = sub.product?.name ?? 'Smart RO Plan';
  const tagline = sub.product?.technology ?? 'Premium subscription';
  const paired = Boolean(sub.device?.serial);
  const serial = sub.device?.serial ?? `SUB-${sub.id.slice(-6).toUpperCase()}`;
  const waterOff = kind === 'inactive' || kind === 'expired';
  // The server decides "online" (seen within 25 h: chips check in about once a day).
  const isOnline = sub.device?.isOnline === true;
  const seenAt = sub.device?.lastSeenAt ?? sub.device?.lastHeartbeatAt ?? null;
  const parsedSeen = seenAt ? new Date(seenAt).getTime() : NaN;
  const lastSeenMs = Number.isFinite(parsedSeen) ? parsedSeen : 0;
  const lastSeen = lastSeenMs ? formatAgo(lastSeenMs) : 'never';
  const installed = sub.booking?.status === 'INSTALLED';

  /* Buttons, from the view model */
  const recharge: ActionButtonSpec = {
    key: 'recharge',
    busyKey: 'recharge',
    label: actions.recharge.label,
    icon: (c) => <Zap size={14} color={c} />,
    enabled: actions.recharge.enabled,
    onPress: onRecharge,
  };
  let primary: ActionButtonSpec | null = null;
  if (kind === 'closed') {
    primary = { key: 'browse', busyKey: null, label: 'Browse purifiers', icon: (c) => <ShoppingBag size={14} color={c} />, enabled: true, onPress: onBrowse };
  } else if (actions.primary === 'installSlot') {
    primary = { key: 'installSlot', busyKey: null, label: actions.installSlot.label, icon: (c) => <CalendarClock size={14} color={c} />, enabled: actions.installSlot.enabled, onPress: onInstallSlot };
  } else if (actions.primary === 'recharge') {
    primary = recharge;
  }

  const secondary: ActionButtonSpec[] = [];
  if (actions.recharge.visible && actions.primary !== 'recharge') secondary.push(recharge);
  if (actions.support.visible) {
    secondary.push({ key: 'support', busyKey: null, label: actions.support.label, icon: (c) => <LifeBuoy size={14} color={c} />, enabled: actions.support.enabled, onPress: onSupport });
  }
  if (actions.autopay.visible) {
    secondary.push({ key: 'autopay', busyKey: 'autopay', label: actions.autopay.label, icon: (c) => <CreditCard size={14} color={c} />, enabled: actions.autopay.enabled, onPress: onAutopay });
  }
  if (actions.smartHealth.visible) {
    secondary.push({ key: 'smartHealth', busyKey: null, label: actions.smartHealth.label, icon: (c) => <Beaker size={14} color={c} />, enabled: true, onPress: onSmartHealth });
  }
  // First row: primary + one secondary (as before); the rest in pairs.
  const rows: { primary: ActionButtonSpec | null; rest: ActionButtonSpec[] }[] = [];
  const queue = [...secondary];
  if (primary) rows.push({ primary, rest: queue.splice(0, 1) });
  while (queue.length) rows.push({ primary: null, rest: queue.splice(0, 2) });

  /* Why something is greyed out, and autopay state worth knowing */
  const notes: { key: string; text: string; warn: boolean }[] = [];
  if (actions.recharge.visible && !actions.recharge.enabled && actions.recharge.reason) {
    notes.push({ key: 'recharge', text: actions.recharge.reason, warn: false });
  }
  const ap = actions.autopay;
  const apText = ap.note ?? (ap.visible && !ap.enabled ? ap.reason : null);
  if (apText) notes.push({ key: 'autopay', text: apText, warn: ap.warn });

  return (
    <View style={styles.statusCard}>
      <View style={styles.statusHead}>
        <Pill tone={view.pill.tone} dot>{view.pill.label}</Pill>
        <Text style={styles.serialText}>{serial}</Text>
      </View>

      <Text style={styles.headline}>{view.headline}</Text>

      <View style={styles.statusBody}>
        <ProgressRing
          progress={view.ring.progress}
          size={132}
          stroke={11}
          label={view.ring.label}
          caption={view.ring.caption}
          pulse={false}
        />
        <View style={{ flex: 1, minWidth: 0, paddingLeft: 16 }}>
          <Text style={styles.statusTagline}>{tagline}</Text>
          <Text style={styles.statusName} numberOfLines={2}>{productName}</Text>
          <View style={{ marginTop: 10 }}>
            {monthlyPaise !== null && kind !== 'closed' ? (
              <Text style={styles.statusPrice}>
                {paiseToInr(monthlyPaise)}
                <Text style={styles.statusPriceSuffix}>/mo</Text>
              </Text>
            ) : null}
            <Text style={styles.statusCycle}>
              {view.daysLeftText}
              {view.cycleText ? ` · ${view.cycleText}` : ''}
            </Text>
          </View>
        </View>
      </View>

      {view.rows.length > 0 ? (
        <View style={styles.metaPanel}>
          {view.rows.map((r) => (
            <MetaRow key={r.key} icon={ROW_ICON[r.icon](tokens.color.accent)} label={r.label} value={r.value} />
          ))}
        </View>
      ) : null}

      {/* Device flow status — surfaces ESP32 pairing + heartbeat */}
      {kind !== 'closed' ? (
        <View style={[styles.metaPanel, { marginTop: 10 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.statusTagline, { color: tokens.color.textMuted }]}>
                {paired ? 'Paired device' : 'Device pairing'}
              </Text>
              <Text numberOfLines={1} style={styles.deviceTitle}>
                {paired
                  ? `${serial} · ${waterOff ? 'Water off' : isOnline ? 'Flowing' : lastSeenMs ? 'Offline' : 'Awaiting first connect'}`
                  : installed ? 'No device paired' : 'Awaiting hardware install'}
              </Text>
              <Text style={styles.deviceSub}>
                {paired
                  ? `Last seen · ${lastSeen}`
                  : installed
                    ? 'Raise a service request and we will pair it.'
                    : 'We will pair your purifier at installation.'}
              </Text>
            </View>
            <Pill tone={!paired ? 'accent' : waterOff ? 'neutral' : isOnline ? 'success' : 'warning'} dot>
              {!paired ? 'Pending' : waterOff ? 'Off' : isOnline ? 'Online' : 'Offline'}
            </Pill>
          </View>
        </View>
      ) : null}

      {rows.map((row, i) => (
        <View key={i} style={[styles.actionRow, i > 0 && { marginTop: 10 }]}>
          {row.primary ? <ActionButton spec={row.primary} primary busy={busy} /> : null}
          {row.rest.map((b) => (
            <ActionButton key={b.key} spec={b} busy={busy} />
          ))}
        </View>
      ))}

      {notes.map((n) => (
        <View key={n.key} style={[styles.note, n.warn && styles.noteWarn]}>
          {n.warn ? (
            <TriangleAlert size={14} color={tokens.color.warn} />
          ) : (
            <Info size={14} color={tokens.color.textMuted} />
          )}
          <Text style={[styles.noteText, n.warn && { color: tokens.color.inkSoft }]}>{n.text}</Text>
        </View>
      ))}

      {/* Trial banner shows only inside the 7-day window */}
      {view.trial ? (
        <View style={styles.trialBox}>
          <Text style={styles.trialTitle}>🎉 7-day trial active</Text>
          <Text style={styles.trialBody}>{view.trial.text}</Text>
        </View>
      ) : null}

      {/* The one cancel entry. During lock-in it says when, instead of failing on tap. */}
      {actions.cancel.visible ? (
        actions.cancel.enabled ? (
          <Pressable
            onPress={onCancel}
            disabled={busy !== null}
            style={({ pressed }) => [styles.cancelLink, { opacity: busy !== null ? 0.5 : pressed ? 0.6 : 1 }]}
          >
            <Text style={styles.cancelText}>
              {busy === 'cancel' ? 'Cancelling…' : actions.cancel.label}
            </Text>
          </Pressable>
        ) : (
          <View style={[styles.cancelLink, styles.cancelLocked]}>
            <Lock size={12} color={tokens.color.textMuted} />
            <Text style={styles.cancelLockedText}>{actions.cancel.reason}</Text>
          </View>
        )
      ) : null}
    </View>
  );
}

function ActionButton({
  spec,
  primary,
  busy,
}: {
  spec: ActionButtonSpec;
  primary?: boolean;
  busy: BusyKey | null;
}) {
  const disabled = !spec.enabled || busy !== null;
  const working = busy !== null && busy === spec.busyKey;
  const fg = primary ? '#FFFFFF' : tokens.color.text;
  return (
    <Pressable
      onPress={spec.onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: working }}
      style={({ pressed }) => [
        primary ? styles.actionPrimary : styles.actionSecondary,
        pressed && { opacity: 0.95 },
        disabled && { opacity: primary && working ? 0.75 : 0.5 },
      ]}
    >
      {primary ? (
        <LinearGradient
          colors={[tokens.color.gradientAccentFrom, tokens.color.gradientAccentTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      ) : null}
      {spec.icon(fg)}
      <Text style={primary ? styles.actionPrimaryText : styles.actionSecondaryText} numberOfLines={1}>
        {working ? 'Working…' : spec.label}
      </Text>
    </Pressable>
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View style={metaStyles.row}>
      <View style={metaStyles.left}>
        {icon}
        <Text style={metaStyles.label}>{label}</Text>
      </View>
      <Text style={metaStyles.value} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.color.bg },

  header: { paddingTop: 12 },
  eyebrow: { ...tokens.text.label, color: tokens.color.textSubtle },
  heading: { ...tokens.text.displayMd, color: tokens.color.text, marginTop: 2 },

  /* Load error */
  errorCard: {
    marginTop: 24,
    backgroundColor: tokens.color.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: 24,
    alignItems: 'center',
    ...tokens.shadow.sm,
  },
  errorTitle: { fontFamily: 'Manrope_800ExtraBold', fontSize: 16, color: tokens.color.text, marginTop: 10 },
  errorBody: { fontSize: 13, color: tokens.color.textMuted, marginTop: 4, textAlign: 'center' },

  /* Status card — mt-5 rounded-3xl shadow-elevated */
  statusCard: {
    marginTop: 20,
    backgroundColor: tokens.color.surface,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: 20,
    ...tokens.shadow.lg,
  },
  statusHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  serialText: { fontFamily: 'Manrope_700Bold', fontSize: 12, color: tokens.color.textMuted, letterSpacing: 0.6 },
  headline: { fontFamily: 'Manrope_700Bold', fontSize: 14, lineHeight: 20, color: tokens.color.text, marginTop: 14 },
  statusBody: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  statusTagline: {
    ...tokens.text.label,
    color: tokens.color.accent,
    fontSize: 10,
  },
  statusName: { fontFamily: 'Manrope_800ExtraBold', fontSize: 18, color: tokens.color.text, marginTop: 4, lineHeight: 22 },
  statusPrice: { fontFamily: 'Manrope_700Bold', fontSize: 16, color: tokens.color.text },
  statusPriceSuffix: { fontFamily: 'Manrope_600SemiBold', fontSize: 12, color: tokens.color.textMuted },
  statusCycle: { fontSize: 12, color: tokens.color.textMuted, marginTop: 2 },

  metaPanel: {
    marginTop: 20,
    backgroundColor: tokens.color.surfaceWarm,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: 12,
    gap: 4,
  },
  deviceTitle: { fontFamily: 'Manrope_800ExtraBold', color: tokens.color.text, fontSize: 16, marginTop: 2 },
  deviceSub: { fontSize: 12, color: tokens.color.textMuted, marginTop: 2 },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  actionPrimary: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    ...tokens.shadow.glow,
  },
  actionPrimaryText: { fontFamily: 'Manrope_800ExtraBold', color: '#FFFFFF', fontSize: 14, flexShrink: 1 },
  actionSecondary: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.borderStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  actionSecondaryText: { fontFamily: 'Manrope_700Bold', color: tokens.color.text, fontSize: 14, flexShrink: 1 },

  note: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: tokens.color.surfaceWarm,
  },
  noteWarn: { backgroundColor: tokens.color.warnSoft },
  noteText: { flex: 1, fontSize: 12, lineHeight: 17, color: tokens.color.textMuted },

  trialBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: tokens.color.accentTint,
    borderWidth: 1,
    borderColor: tokens.color.accentSoft,
  },
  trialTitle: { fontFamily: 'Manrope_800ExtraBold', color: tokens.color.accentInk, fontSize: 13 },
  trialBody: { fontSize: 12, color: tokens.color.accentInk, marginTop: 2 },

  cancelLink: { marginTop: 10, paddingVertical: 10, alignItems: 'center' },
  cancelText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: tokens.color.textMuted,
    textDecorationLine: 'underline',
  },
  cancelLocked: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  cancelLockedText: { fontSize: 12, color: tokens.color.textMuted, textAlign: 'center', flexShrink: 1 },

  /* Past plans */
  pastCard: {
    marginTop: 20,
    backgroundColor: tokens.color.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: tokens.color.border,
    paddingHorizontal: 18,
    paddingVertical: 14,
    ...tokens.shadow.xs,
  },
  pastHead: { flexDirection: 'row', alignItems: 'center' },
  pastHeading: { fontFamily: 'Manrope_800ExtraBold', fontSize: 15, color: tokens.color.text, marginTop: 2 },
  pastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: tokens.color.border,
    marginTop: 10,
  },
  pastTitle: { fontFamily: 'Manrope_700Bold', fontSize: 13, color: tokens.color.text },
  pastMeta: { fontSize: 11, color: tokens.color.textMuted, marginTop: 2 },
  pastWarn: { fontSize: 11, color: tokens.color.warn, marginTop: 2 },

  /* Section heads */
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end' },
  eyebrowMuted: { ...tokens.text.label, color: tokens.color.textSubtle },
  sectionTitle: { ...tokens.text.headingLg, color: tokens.color.text, marginTop: 2 },

  /* Timeline */
  timelineWrap: { marginTop: 14, paddingLeft: 28 },
  timelineLine: {
    position: 'absolute',
    left: 11,
    top: 8,
    bottom: 8,
    width: 2,
    backgroundColor: tokens.color.border,
  },
  timelineItem: { marginBottom: 14 },
  timelineDot: {
    position: 'absolute',
    left: -28,
    top: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.color.accent,
  },
  timelineCard: {
    backgroundColor: tokens.color.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: 14,
    ...tokens.shadow.xs,
  },
  timelineHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timelineTitle: { fontFamily: 'Manrope_700Bold', fontSize: 13, color: tokens.color.text, flex: 1 },
  timelineMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timelineMeta: { fontSize: 11, color: tokens.color.textMuted, flex: 1 },
  timelineDate: { fontSize: 11, color: tokens.color.textMuted, fontFamily: 'Manrope_700Bold' },

  /* Bills */
  billsCard: {
    marginTop: 32,
    backgroundColor: tokens.color.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: 18,
    ...tokens.shadow.sm,
  },
  billsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 130,
    marginTop: 12,
  },
  billCol: { flex: 1, alignItems: 'center', gap: 6 },
  billAmount: { fontFamily: 'Manrope_700Bold', fontSize: 9.5, color: tokens.color.textMuted },
  billBarTrack: {
    width: '70%',
    // Fixed: a % height of an auto-height column is 0 on web, so no bar drew.
    height: 84,
    overflow: 'hidden',
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  billBarFill: { width: '100%', borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  billMonth: { fontFamily: 'Manrope_700Bold', fontSize: 11, color: tokens.color.textMuted },

  /* Side door */
  sideDoor: {
    marginTop: 24,
    backgroundColor: tokens.color.accentTint,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: tokens.color.accentSoft,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  sideDoorIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: tokens.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.shadow.glow,
  },
  sideDoorTitle: { fontFamily: 'Manrope_800ExtraBold', fontSize: 14, color: tokens.color.accentInk },
  sideDoorSub: { fontSize: 11, color: 'rgba(10,74,107,0.7)', marginTop: 2 },
});

const metaStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, gap: 12 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { ...tokens.text.bodySm, color: tokens.color.textMuted },
  value: { fontFamily: 'Manrope_700Bold', color: tokens.color.text, fontSize: 13, flexShrink: 1, textAlign: 'right' },
});
