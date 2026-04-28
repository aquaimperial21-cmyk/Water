import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Tickets } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { colors, radius, spacing, type } from '../../theme';
import type { RootStackParamList } from '../../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'NewTicket'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

const CATEGORIES = [
  { key: 'REPAIR', label: 'Repair', icon: 'build' as const },
  { key: 'FILTER', label: 'Filter', icon: 'filter-alt' as const },
  { key: 'INSTALL', label: 'Install', icon: 'plumbing' as const },
  { key: 'PICKUP', label: 'Pickup', icon: 'local-shipping' as const },
  { key: 'OTHER', label: 'Other', icon: 'help-outline' as const },
];

const PRIORITIES = [
  { key: 'LOW', label: 'Low', icon: 'low-priority' as const, danger: false },
  { key: 'MEDIUM', label: 'Medium', icon: 'priority-high' as const, danger: false },
  { key: 'HIGH', label: 'High', icon: 'warning' as const, danger: true },
];

export function NewTicketScreen({ route, navigation }: Props) {
  const nav = useNavigation<Nav>();
  const { subscriptionId } = route.params;
  const [category, setCategory] = React.useState<string>('REPAIR');
  const [priority, setPriority] = React.useState<string>('MEDIUM');
  const [description, setDescription] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  async function submit() {
    if (description.trim().length < 5) {
      return Alert.alert('Description', 'Tell us a bit more (at least 5 characters).');
    }
    setLoading(true);
    try {
      await Tickets.create({ subscriptionId, category, description, priority });
      Alert.alert('Ticket raised', 'Our team will reach out shortly.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Error', apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceBright }}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={22} color={colors.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>New Ticket</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[type.headlineMd, { color: colors.onSurface }]}>What's the issue?</Text>
        <Text style={[type.bodyMd, { color: colors.onSurfaceVariant, marginTop: 4, marginBottom: spacing.lg }]}>
          We'll dispatch a technician based on category and SLA.
        </Text>

        {/* Category */}
        <Text style={styles.sectionLabel}>Category</Text>
        <View style={styles.chipRow}>
          {CATEGORIES.map((c) => (
            <Chip
              key={c.key}
              label={c.label}
              icon={c.icon}
              active={category === c.key}
              onPress={() => setCategory(c.key)}
            />
          ))}
        </View>

        {/* Priority */}
        <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>Priority</Text>
        <View style={styles.chipRow}>
          {PRIORITIES.map((p) => (
            <Chip
              key={p.key}
              label={p.label}
              icon={p.icon}
              active={priority === p.key}
              tone={p.danger ? 'danger' : 'default'}
              onPress={() => setPriority(p.key)}
            />
          ))}
        </View>

        {/* Description */}
        <View style={{ height: spacing.lg }} />
        <Input
          label="Describe the issue"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={5}
          placeholder="Water flow has reduced and there's a strange humming sound..."
          style={{ minHeight: 120, textAlignVertical: 'top' }}
        />

        {/* Submit */}
        <Button title="Submit ticket" iconRight="send" onPress={submit} loading={loading} fullWidth style={{ marginTop: spacing.md }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...type.titleLg, color: colors.primary, fontSize: 18 },

  sectionLabel: { ...type.titleMd, color: colors.onSurface, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
