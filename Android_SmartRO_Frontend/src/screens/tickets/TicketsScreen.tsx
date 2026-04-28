import React from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Ticket, Tickets } from '../../api/endpoints';
import { colors, spacing, type } from '../../theme';
import { formatDateTime } from '../../utils/format';
import type { RootStackParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function TicketsScreen() {
  const navigation = useNavigation<Nav>();
  const [tickets, setTickets] = React.useState<Ticket[] | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(async () => {
    setRefreshing(true);
    try { setTickets(await Tickets.mine()); } finally { setRefreshing(false); }
  }, []);

  React.useEffect(() => { void load(); }, [load]);
  React.useEffect(() => navigation.addListener('focus', load), [navigation, load]);

  if (!tickets) return <Screen><ActivityIndicator color={colors.primary} /></Screen>;

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
          <Text style={type.h1}>Tickets</Text>
          <Button title="+ New" size="md" onPress={() => navigation.navigate('NewTicket', {})} />
        </View>

        {tickets.length === 0 ? (
          <Card>
            <Text style={type.h3}>No tickets yet</Text>
            <Text style={{ color: colors.textMuted, marginTop: 6 }}>You haven't raised any service requests.</Text>
          </Card>
        ) : (
          tickets.map((t) => (
            <Card key={t.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={type.h3}>{t.category}</Text>
                <Badge label={t.status} tone={statusTone(t.status)} />
              </View>
              <Text style={{ color: colors.text, marginTop: 6 }}>{t.description}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>Priority: {t.priority}</Text>
                <Text style={styles.meta}>Raised: {formatDateTime(t.createdAt)}</Text>
              </View>
              {t.slaDueAt ? <Text style={styles.meta}>SLA due: {formatDateTime(t.slaDueAt)}</Text> : null}
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function statusTone(s: string): 'success' | 'warning' | 'info' | 'danger' | 'neutral' {
  if (s === 'RESOLVED' || s === 'CLOSED') return 'success';
  if (s === 'OPEN' || s === 'REOPENED') return 'warning';
  if (s === 'IN_PROGRESS' || s === 'ASSIGNED') return 'info';
  return 'neutral';
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  meta: { color: colors.textMuted, fontSize: 12 },
});
