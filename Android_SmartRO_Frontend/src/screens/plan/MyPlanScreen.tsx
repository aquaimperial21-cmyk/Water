import React from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Subscription, Subscriptions, Tickets } from '../../api/endpoints';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { colors, spacing, type } from '../../theme';
import { daysFromNow, formatDate, paiseToInr } from '../../utils/format';
import { apiErrorMessage } from '../../api/client';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
      Alert.alert('Done', 'Recharge successful. Your plan has been extended.');
    } catch (e) {
      Alert.alert('Recharge failed', apiErrorMessage(e));
    } finally {
      setRecharging(false);
    }
  }

  async function raiseTicket(sub: Subscription) {
    try {
      await Tickets.create({ subscriptionId: sub.id, category: 'FILTER', description: 'Quick filter check requested from My Plan' });
      Alert.alert('Ticket raised', 'A SmartRO technician will reach out shortly.');
    } catch (e) {
      Alert.alert('Error', apiErrorMessage(e));
    }
  }

  if (!subs) return <Screen><ActivityIndicator color={colors.primary} /></Screen>;

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
      >
        <Text style={[type.h1, { marginBottom: spacing.md }]}>My Plan</Text>
        {subs.length === 0 ? (
          <Card>
            <Text style={type.h3}>No active subscription</Text>
            <Text style={{ color: colors.textMuted, marginTop: 6 }}>
              Browse purifiers from the Home tab to get started.
            </Text>
          </Card>
        ) : (
          subs.map((sub) => {
            const days = daysFromNow(sub.expiresAt);
            const tone = sub.status === 'ACTIVE' ? 'success' : sub.status === 'GRACE' ? 'warning' : 'danger';
            return (
              <Card key={sub.id}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={type.h3}>{sub.product?.name}</Text>
                  <Badge tone={tone} label={sub.status} />
                </View>
                <Text style={styles.muted}>Plan: {sub.plan?.name}</Text>
                {sub.device ? <Text style={styles.muted}>Device: {sub.device.serial}</Text> : <Text style={styles.muted}>Device assignment pending</Text>}
                <View style={styles.metricRow}>
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>Expires</Text>
                    <Text style={styles.metricValue}>{formatDate(sub.expiresAt)}</Text>
                    <Text style={styles.metricSub}>{days >= 0 ? `${days} days remaining` : `${Math.abs(days)} days overdue`}</Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>Lock-in until</Text>
                    <Text style={styles.metricValue}>{formatDate(sub.lockInUntil)}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <Button title="Recharge" onPress={() => recharge(sub)} loading={recharging} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button title="Quick filter check" variant="secondary" onPress={() => raiseTicket(sub)} />
                  </View>
                </View>
                <Button
                  title="Raise a service ticket"
                  variant="ghost"
                  size="md"
                  style={{ marginTop: spacing.sm }}
                  onPress={() => navigation.navigate('NewTicket', { subscriptionId: sub.id })}
                />
              </Card>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.textMuted, marginTop: 4, fontSize: 13 },
  metricRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  metric: { flex: 1, backgroundColor: colors.bg, padding: spacing.md, borderRadius: 10 },
  metricLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  metricValue: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 4 },
  metricSub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
});
