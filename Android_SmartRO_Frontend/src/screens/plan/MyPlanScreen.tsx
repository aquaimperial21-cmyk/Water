import React from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Subscription, Subscriptions, Tickets } from '../../api/endpoints';
import { Badge } from '../../components/Badge';
import { Bubbles } from '../../components/Bubbles';
import { Button } from '../../components/Button';
import { ProgressRing } from '../../components/ProgressRing';
import { colors, radius, spacing, type, shadow } from '../../theme';
import { daysFromNow, formatDate } from '../../utils/format';
import { apiErrorMessage } from '../../api/client';
import type { RootStackParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function MyPlanScreen() {
  const navigation = useNavigation<Nav>();
  const [subs, setSubs] = React.useState<Subscription[] | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [recharging, setRecharging] = React.useState(false);

  const load = React.useCallback(async () => {
    setRefreshing(true);
    try {
      setSubs(await Subscriptions.mine());
    } catch (e) {
      Alert.alert('Error', apiErrorMessage(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  async function recharge(sub: Subscription) {
    setRecharging(true);
    try {
      await Subscriptions.recharge(sub.id);
      await load();
      Alert.alert('Done', 'Plan extended successfully.');
    } catch (e) {
      Alert.alert('Recharge failed', apiErrorMessage(e));
    } finally {
      setRecharging(false);
    }
  }

  async function quickFilter(sub: Subscription) {
    try {
      await Tickets.create({ subscriptionId: sub.id, category: 'FILTER', description: 'Quick filter check from My Plan' });
      Alert.alert('Ticket raised', 'A technician will reach out shortly.');
    } catch (e) {
      Alert.alert('Error', apiErrorMessage(e));
    }
  }

  if (!subs) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBright }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceBright }}>
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>My Plan</Text>
        <View style={styles.iconBtn}>
          <MaterialIcons name="notifications-none" size={22} color={colors.onSurfaceVariant} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
      >
        {subs.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="layers" size={32} color={colors.primary} />
            </View>
            <Text style={[type.titleLg, { color: colors.onSurface, marginTop: spacing.md }]}>
              No active subscription
            </Text>
            <Text style={[type.bodyMd, { color: colors.onSurfaceVariant, textAlign: 'center', marginTop: 6 }]}>
              Browse purifiers from the Home tab to get started.
            </Text>
          </View>
        ) : (
          subs.map((sub) => {
            const days = daysFromNow(sub.expiresAt);
            const totalDays = 180;
            const ringProgress = Math.max(0, Math.min(1, days / totalDays));
            const tone = sub.status === 'ACTIVE' ? 'success' : sub.status === 'GRACE' ? 'warning' : 'danger';
            return (
              <View key={sub.id} style={styles.subCard}>
                {/* Header with gradient strip */}
                <LinearGradient
                  colors={[colors.primaryFixed, colors.surfaceContainerLowest]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.subHeadStrip}
                >
                  <Bubbles
                    bubbles={[
                      { size: 120, top: -40, right: -20, color: colors.primary, opacity: 0.06 },
                    ]}
                  />
                  <View style={styles.subHead}>
                    <View style={styles.devicePic}>
                      <MaterialIcons name="opacity" size={36} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <Badge tone={tone} label={sub.status} />
                      <Text style={[type.titleLg, { color: colors.onSurface, marginTop: 6 }]} numberOfLines={1}>
                        {sub.product?.name}
                      </Text>
                      <Text style={[type.bodyMd, { color: colors.onSurfaceVariant, fontSize: 13 }]}>
                        Plan: {sub.plan?.name}
                      </Text>
                    </View>
                  </View>
                </LinearGradient>

                {/* Filter ring + days remaining */}
                <View style={styles.subBody}>
                <View style={styles.ringRow}>
                  <ProgressRing size={64} stroke={6} progress={ringProgress}>
                    <Text style={styles.ringDays}>{Math.max(days, 0)}</Text>
                    <Text style={styles.ringLabel}>days</Text>
                  </ProgressRing>
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text style={[type.labelSm, { color: colors.onSurface, fontSize: 11 }]}>
                      {sub.status === 'GRACE' ? 'In grace period' : sub.status === 'ACTIVE' ? 'Active subscription' : sub.status}
                    </Text>
                    <Text style={styles.ringMeta}>
                      {days >= 0 ? `Renews on ${formatDate(sub.expiresAt)}` : `${Math.abs(days)} days overdue`}
                    </Text>
                  </View>
                </View>

                {/* Metrics grid */}
                <View style={styles.metricRow}>
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>Expires</Text>
                    <Text style={styles.metricValue}>{formatDate(sub.expiresAt)}</Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>Lock-in until</Text>
                    <Text style={styles.metricValue}>{formatDate(sub.lockInUntil)}</Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>Device</Text>
                    <Text style={styles.metricValue} numberOfLines={1}>
                      {sub.device?.serial ?? 'Pending'}
                    </Text>
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.actionRow}>
                  <View style={{ flex: 1 }}>
                    <Button title="Recharge" iconLeft="bolt" onPress={() => recharge(sub)} loading={recharging} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button title="Quick filter" iconLeft="filter-alt" variant="secondary" onPress={() => quickFilter(sub)} />
                  </View>
                </View>
                <Button
                  title="Raise a service ticket"
                  variant="tonal"
                  size="md"
                  iconLeft="confirmation-number"
                  fullWidth
                  style={{ marginTop: spacing.sm }}
                  onPress={() => navigation.navigate('NewTicket', { subscriptionId: sub.id })}
                />
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    height: 56,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(193,198,215,0.4)',
  },
  topTitle: { ...type.headlineMd, color: colors.onSurface, fontSize: 22 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  emptyCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    ...shadow.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },

  subCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(193,198,215,0.4)',
    ...shadow.sm,
  },
  subHeadStrip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    overflow: 'hidden',
  },
  subBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  subHead: { flexDirection: 'row', alignItems: 'flex-start' },
  devicePic: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },

  ringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  ringDays: { ...type.titleLg, color: colors.primary, fontSize: 18 },
  ringLabel: { ...type.caption, color: colors.onSurfaceVariant, fontSize: 9 },
  ringMeta: { ...type.bodyMd, color: colors.onSurfaceVariant, fontSize: 13, marginTop: 2 },

  metricRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  metric: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLow,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(193,198,215,0.3)',
  },
  metricLabel: { ...type.labelSm, color: colors.onSurfaceVariant, fontSize: 9 },
  metricValue: { ...type.bodyMdSemi, color: colors.onSurface, fontSize: 13, marginTop: 2 },

  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});
