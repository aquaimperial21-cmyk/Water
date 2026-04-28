import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Tickets } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { colors, radius, spacing, type } from '../../theme';
import type { RootStackParamList } from '../../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'NewTicket'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

const CATEGORIES = ['REPAIR', 'FILTER', 'INSTALL', 'PICKUP', 'OTHER'] as const;
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;

export function NewTicketScreen({ route }: Props) {
  const navigation = useNavigation<Nav>();
  const { subscriptionId } = route.params;
  const [category, setCategory] = React.useState<(typeof CATEGORIES)[number]>('REPAIR');
  const [priority, setPriority] = React.useState<(typeof PRIORITIES)[number]>('MEDIUM');
  const [description, setDescription] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  async function submit() {
    if (description.length < 5) return Alert.alert('Description', 'Tell us a bit more (5+ chars).');
    setLoading(true);
    try {
      await Tickets.create({ subscriptionId, category, description, priority });
      Alert.alert('Ticket raised', 'Our team will reach out shortly.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert('Error', apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll>
      <Text style={type.h2}>What's the issue?</Text>
      <Text style={{ color: colors.textMuted, marginTop: 4, marginBottom: spacing.lg }}>
        We'll dispatch a technician based on category and SLA.
      </Text>
      <Text style={styles.label}>Category</Text>
      <View style={styles.row}>
        {CATEGORIES.map((c) => (
          <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, category === c && styles.chipActive]}>
            <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={[styles.label, { marginTop: spacing.lg }]}>Priority</Text>
      <View style={styles.row}>
        {PRIORITIES.map((p) => (
          <Pressable key={p} onPress={() => setPriority(p)} style={[styles.chip, priority === p && styles.chipActive]}>
            <Text style={[styles.chipText, priority === p && styles.chipTextActive]}>{p}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ height: spacing.lg }} />
      <Input
        label="Describe the issue"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={5}
        placeholder="Water flow has reduced and there's a strange humming sound..."
        style={{ minHeight: 100, textAlignVertical: 'top' }}
      />
      <Button title="Submit ticket" onPress={submit} loading={loading} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: '#fff' },
});
