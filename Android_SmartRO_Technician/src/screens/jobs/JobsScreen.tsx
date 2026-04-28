import React from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Badge, Card, Screen } from '../../components/UI';
import { Job, Tech } from '../../api/endpoints';
import { colors, spacing, type } from '../../theme';
import type { RootStackParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Tab = 'TODAY' | 'ALL';

export function JobsScreen() {
  const navigation = useNavigation<Nav>();
  const [tab, setTab] = React.useState<Tab>('TODAY');
  const [jobs, setJobs] = React.useState<Job[] | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(async () => {
    setRefreshing(true);
    try {
      setJobs(tab === 'TODAY' ? await Tech.todayJobs() : await Tech.allJobs());
    } finally {
      setRefreshing(false);
    }
  }, [tab]);

  React.useEffect(() => { void load(); }, [load]);
  React.useEffect(() => navigation.addListener('focus', load), [navigation, load]);

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Text style={[type.h1, { color: colors.text }]}>Jobs</Text>
        <View style={styles.tabRow}>
          {(['TODAY', 'ALL'] as Tab[]).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
              <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>{t}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      {!jobs ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
        >
          {jobs.length === 0 ? (
            <Card>
              <Text style={type.h3}>{tab === 'TODAY' ? "No jobs scheduled today" : 'No jobs yet'}</Text>
              <Text style={{ color: colors.textMuted, marginTop: 6 }}>Pull down to refresh.</Text>
            </Card>
          ) : (
            jobs.map((j) => {
              const dt = new Date(j.scheduledFor);
              const time = dt.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit' });
              const date = dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
              return (
                <Card key={j.id} onPress={() => navigation.navigate('JobDetail', { id: j.id })}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={type.h3}>{j.type} job</Text>
                    <Badge tone={statusTone(j.status)} label={j.status} />
                  </View>
                  <Text style={styles.muted}>Scheduled: {date}, {time}</Text>
                  {j.ticket ? (
                    <>
                      <Text style={[styles.bodyText, { marginTop: 6 }]}>{j.ticket.user.fullName ?? 'Customer'}</Text>
                      <Text style={styles.muted}>📞 {j.ticket.user.phone}</Text>
                      <Text style={[styles.bodyText, { marginTop: 6 }]} numberOfLines={2}>
                        {j.ticket.description}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.muted}>No ticket linked.</Text>
                  )}
                </Card>
              );
            })
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

function statusTone(s: Job['status']): 'success' | 'warning' | 'info' | 'danger' | 'neutral' {
  if (s === 'DONE') return 'success';
  if (s === 'SCHEDULED') return 'warning';
  if (s === 'EN_ROUTE' || s === 'IN_PROGRESS') return 'info';
  if (s === 'CANCELLED') return 'danger';
  return 'neutral';
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg, paddingBottom: spacing.md },
  tabRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  tab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabLabel: { color: colors.text, fontWeight: '600', fontSize: 13 },
  tabLabelActive: { color: '#fff' },
  muted: { color: colors.textMuted, marginTop: 4, fontSize: 13 },
  bodyText: { color: colors.text, fontSize: 14 },
});
