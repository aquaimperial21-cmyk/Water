import React from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { Badge, Button, Card, Input, Screen } from '../../components/UI';
import { Job, Tech } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { colors, spacing, type } from '../../theme';
import type { RootStackParamList } from '../../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'JobDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export function JobDetailScreen({ route }: Props) {
  const navigation = useNavigation<Nav>();
  const { id } = route.params;
  const [job, setJob] = React.useState<Job | null>(null);
  const [notes, setNotes] = React.useState('');
  const [working, setWorking] = React.useState(false);

  const load = React.useCallback(async () => {
    setJob(await Tech.job(id));
  }, [id]);

  React.useEffect(() => { void load(); }, [load]);
  React.useEffect(() => {
    if (job?.notes) setNotes(job.notes);
  }, [job?.notes]);

  if (!job) return <Screen><ActivityIndicator color={colors.primary} /></Screen>;

  async function setStatus(next: Job['status']) {
    setWorking(true);
    try {
      const updated = await Tech.updateStatus(id, next, notes || undefined);
      setJob({ ...job!, ...updated });
      if (next === 'DONE') Alert.alert('Job complete', 'Customer has been notified.');
    } catch (e) {
      Alert.alert('Error', apiErrorMessage(e));
    } finally {
      setWorking(false);
    }
  }

  function call() {
    const phone = job?.ticket?.user.phone;
    if (phone) void Linking.openURL(`tel:${phone}`);
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
          <Text style={type.h1}>{job.type} job</Text>
          <Badge tone={tone(job.status)} label={job.status} />
        </View>

        <Card>
          <Text style={type.h3}>Schedule</Text>
          <Text style={styles.muted}>
            {new Date(job.scheduledFor).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </Text>
        </Card>

        {job.ticket ? (
          <Card>
            <Text style={type.h3}>Customer</Text>
            <Text style={[styles.body, { marginTop: 6 }]}>{job.ticket.user.fullName ?? 'Customer'}</Text>
            <Text style={styles.muted}>📞 {job.ticket.user.phone}</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Button title="Call" variant="secondary" onPress={call} />
              </View>
            </View>
            <View style={{ height: spacing.md }} />
            <Text style={type.h3}>Issue</Text>
            <Text style={[styles.body, { marginTop: 4 }]}>{job.ticket.description}</Text>
            <Text style={styles.muted}>Category: {job.ticket.category}  ·  Priority: {job.ticket.priority}</Text>
            {job.ticket.device ? <Text style={styles.muted}>Device: {job.ticket.device.serial}</Text> : null}
          </Card>
        ) : null}

        <Card>
          <Text style={type.h3}>Checklist</Text>
          {checklistFor(job.type).map((c, i) => (
            <Text key={i} style={[styles.body, { marginTop: 6 }]}>☐ {c}</Text>
          ))}
        </Card>

        <Card>
          <Text style={type.h3}>Field notes</Text>
          <View style={{ height: spacing.sm }} />
          <Input
            placeholder="TDS in: ___ / TDS out: ___ / Filter: ___"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            style={{ minHeight: 90, textAlignVertical: 'top' }}
          />
        </Card>

        {job.status !== 'DONE' && job.status !== 'CANCELLED' ? (
          <Card>
            <Text style={type.h3}>Update status</Text>
            <View style={{ height: spacing.sm }} />
            {job.status === 'SCHEDULED' && <Button title="Mark en-route" onPress={() => setStatus('EN_ROUTE')} loading={working} />}
            {(job.status === 'SCHEDULED' || job.status === 'EN_ROUTE') && (
              <Button title="Start work" onPress={() => setStatus('IN_PROGRESS')} variant="secondary" style={{ marginTop: spacing.sm }} loading={working} />
            )}
            {(job.status === 'IN_PROGRESS' || job.status === 'EN_ROUTE') && (
              <Button title="Complete job ✓" onPress={() => setStatus('DONE')} style={{ marginTop: spacing.sm }} loading={working} />
            )}
            <Button title="Cancel job" variant="ghost" onPress={() => setStatus('CANCELLED')} style={{ marginTop: spacing.sm }} loading={working} />
          </Card>
        ) : (
          <Card style={{ borderColor: job.status === 'DONE' ? colors.success : colors.danger, borderWidth: 1.5 }}>
            <Text style={[type.h3, { color: job.status === 'DONE' ? colors.success : colors.danger }]}>
              {job.status === 'DONE' ? '✓ Job completed' : '✗ Job cancelled'}
            </Text>
            <Text style={[styles.muted, { marginTop: 4 }]}>
              {job.completedAt ? `Completed at ${new Date(job.completedAt).toLocaleString('en-IN')}` : ''}
            </Text>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

function tone(s: Job['status']): 'success' | 'warning' | 'info' | 'danger' | 'neutral' {
  if (s === 'DONE') return 'success';
  if (s === 'SCHEDULED') return 'warning';
  if (s === 'EN_ROUTE' || s === 'IN_PROGRESS') return 'info';
  if (s === 'CANCELLED') return 'danger';
  return 'neutral';
}

function checklistFor(type: string): string[] {
  if (type === 'INSTALL') {
    return [
      'Confirm device serial matches dispatch',
      'Pre-install: take photo of mounting area',
      'Install + leak check',
      'Take TDS-in / TDS-out reading',
      'Walk customer through filter timing',
      'Capture customer e-signature on completion',
    ];
  }
  if (type === 'FILTER') {
    return [
      'Scan device QR',
      'Replace filter (note serial)',
      'Pressure-test post-replacement',
      'TDS-in / TDS-out reading',
      'Customer signature',
    ];
  }
  if (type === 'PICKUP') {
    return [
      'Verify customer ID',
      'Photograph device condition (4 angles)',
      'Drain + pack device',
      'Capture pickup signature',
    ];
  }
  return ['Diagnose issue', 'Repair / replace as needed', 'Test water flow', 'TDS reading', 'Customer signature'];
}

const styles = StyleSheet.create({
  muted: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  body: { color: colors.text, fontSize: 14 },
});
