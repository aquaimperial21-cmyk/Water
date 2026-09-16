import React from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { notify } from '../../utils/confirm';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  Droplets,
  Coffee,
  Filter as FilterIcon,
  HelpCircle,
  ImagePlus,
  Lock,
  Volume2,
  Wrench,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { Tickets } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { tokens } from '@theme/tokens';
import type { RootStackParamList } from '../../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'NewTicket'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

type IssueKey = 'NO_WATER' | 'LEAK' | 'TASTE' | 'FILTER' | 'NOISE' | 'OTHER';
type Priority = 'LOW' | 'MEDIUM' | 'HIGH';

const ISSUES: {
  key: IssueKey;
  label: string;
  Icon: any;
  hint: string;
  category: string;
}[] = [
  { key: 'NO_WATER', label: 'No water', Icon: Droplets, hint: 'No water flow when I open the dispenser. Started ', category: 'REPAIR' },
  { key: 'LEAK', label: 'Leak', Icon: Wrench, hint: 'I see water leaking from the unit near ', category: 'REPAIR' },
  { key: 'TASTE', label: 'Strange taste', Icon: Coffee, hint: 'The water tastes/smells different. Noticed ', category: 'FILTER' },
  { key: 'FILTER', label: 'Filter change', Icon: FilterIcon, hint: 'Requesting a filter change because ', category: 'FILTER' },
  { key: 'NOISE', label: 'Noise', Icon: Volume2, hint: 'The unit is making unusual noise during ', category: 'REPAIR' },
  { key: 'OTHER', label: 'Other', Icon: HelpCircle, hint: '', category: 'OTHER' },
];

const PRIORITIES: { key: Priority; label: string; sla: string }[] = [
  { key: 'LOW', label: 'Low', sla: '48h SLA' },
  { key: 'MEDIUM', label: 'Medium', sla: '24h SLA' },
  { key: 'HIGH', label: 'High', sla: '4h SLA' },
];

export function NewTicketScreen({ route, navigation }: Props) {
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { subscriptionId } = route.params;
  const [issueKey, setIssueKey] = React.useState<IssueKey | null>(null);
  const [priority, setPriority] = React.useState<Priority>('MEDIUM');
  const [description, setDescription] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  function pickIssue(key: IssueKey) {
    setIssueKey(key);
    const issue = ISSUES.find((i) => i.key === key);
    if (issue && !description.trim()) setDescription(issue.hint);
  }

  async function submit() {
    if (!issueKey) return notify('Pick an issue', 'Choose what kind of help you need.');
    if (description.trim().length < 10)
      return notify('Tell us more', 'Add at least a sentence describing the problem.');
    const issue = ISSUES.find((i) => i.key === issueKey);
    setLoading(true);
    try {
      await Tickets.create({
        subscriptionId,
        category: issue?.category ?? 'OTHER',
        description: description.trim(),
        priority,
      });
      notify('Ticket raised', 'A technician will reach out shortly.');
      navigation.goBack();
    } catch (e) {
      notify('Could not submit', apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  const ready = !!issueKey && description.trim().length >= 10 && !loading;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.topWrap}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} hitSlop={10}>
            <ArrowLeft size={18} color={tokens.color.text} />
          </Pressable>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.topEyebrow}>Service</Text>
            <Text style={styles.topTitle}>New ticket</Text>
          </View>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        // Android too: this keyboard draws over the window instead of
        // resizing it, so leaving this undefined leaves fields underneath it.
        behavior="padding"
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: insets.top + 70,
            paddingBottom: 200,
          }}
        >
          <Text style={styles.heading}>Pick the issue.</Text>
          <Text style={styles.lede}>Choose what describes it best.</Text>

          {/* Issue grid */}
          <View style={styles.grid}>
            {ISSUES.map((it) => {
              const selected = issueKey === it.key;
              const Icon = it.Icon;
              return (
                <View key={it.key} style={styles.issueCell}>
                  <Pressable
                    onPress={() => pickIssue(it.key)}
                    style={[styles.issueCard, selected && styles.issueCardSelected]}
                  >
                    <View
                      style={[
                        styles.issueIconBox,
                        selected ? styles.issueIconBoxSelected : null,
                      ]}
                    >
                      <Icon
                        size={20}
                        color={selected ? '#FFFFFF' : tokens.color.accentInk}
                      />
                    </View>
                    <Text
                      style={[
                        styles.issueLabel,
                        selected && { color: '#FFFFFF' },
                      ]}
                    >
                      {it.label}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>

          {/* Priority */}
          <Text style={[styles.sectionLabel, { marginTop: 28 }]}>Priority</Text>
          <View style={styles.priorityRow}>
            {PRIORITIES.map((p) => {
              const sel = priority === p.key;
              return (
                <Pressable
                  key={p.key}
                  onPress={() => setPriority(p.key)}
                  style={[styles.priorityCard, sel && styles.priorityCardSelected]}
                >
                  <Text
                    style={[
                      styles.priorityLabel,
                      sel && { color: '#FFFFFF' },
                    ]}
                  >
                    {p.label}
                  </Text>
                  <Text
                    style={[
                      styles.prioritySla,
                      sel && { color: 'rgba(255,255,255,0.75)' },
                    ]}
                  >
                    {p.sla}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Description */}
          <View style={[styles.sectionRow, { marginTop: 28 }]}>
            <Text style={styles.sectionLabel}>Description</Text>
            <Text style={styles.charCount}>{description.length}/500</Text>
          </View>
          <TextInput
            multiline
            value={description}
            onChangeText={(t) => setDescription(t.slice(0, 500))}
            placeholder="Tell us what's happening so we can come prepared."
            placeholderTextColor={tokens.color.textSubtle}
            style={styles.textArea}
            selectionColor={tokens.color.accent}
          />

          {/* Photo slots */}
          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Photos (optional)</Text>
          <View style={styles.photoRow}>
            {[0, 1, 2].map((i) => (
              <Pressable key={i} style={styles.photoCell}>
                <ImagePlus size={20} color={tokens.color.textMuted} />
              </Pressable>
            ))}
          </View>

          <View style={styles.privacy}>
            <Lock size={14} color={tokens.color.textMuted} />
            <Text style={styles.privacyText}>
              Photos are only seen by your assigned technician. Deleted after 90 days.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sticky submit */}
      <View
        style={[
          styles.footerWrap,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        <Pressable
          disabled={!ready}
          onPress={submit}
          style={({ pressed }) => [
            styles.cta,
            !ready && styles.ctaDisabled,
            pressed && ready && { opacity: 0.95 },
          ]}
        >
          <LinearGradient
            colors={
              ready
                ? [tokens.color.gradientAccentFrom, tokens.color.gradientAccentTo]
                : [tokens.color.surfaceMuted, tokens.color.surfaceMuted]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Text
            style={[
              styles.ctaText,
              !ready && { color: tokens.color.textSubtle },
            ]}
          >
            {loading ? 'Submitting…' : 'Submit ticket'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.color.bg },

  topWrap: {
    backgroundColor: 'rgba(250,248,245,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.border,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.shadow.xs,
  },
  topEyebrow: { ...tokens.text.label, color: tokens.color.textSubtle, fontSize: 9.5 },
  topTitle: { fontFamily: 'Manrope_700Bold', fontSize: 14, color: tokens.color.text, marginTop: 1 },

  heading: { ...tokens.text.displayMd, color: tokens.color.text },
  lede: { ...tokens.text.bodySm, color: tokens.color.textMuted, marginTop: 4 },

  grid: { marginTop: 20, flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  issueCell: { width: '50%', padding: 6 },
  issueCard: {
    borderRadius: 18,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: 14,
    ...tokens.shadow.xs,
  },
  issueCardSelected: {
    backgroundColor: tokens.color.accent,
    borderColor: tokens.color.accent,
    ...tokens.shadow.glow,
  },
  issueIconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: tokens.color.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  issueIconBoxSelected: { backgroundColor: 'rgba(255,255,255,0.2)' },
  issueLabel: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 14,
    color: tokens.color.text,
    marginTop: 12,
  },

  sectionLabel: { ...tokens.text.label, color: tokens.color.textSubtle },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  charCount: { fontFamily: 'Manrope_700Bold', fontSize: 11, color: tokens.color.textMuted },

  priorityRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  priorityCard: {
    flex: 1,
    backgroundColor: tokens.color.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: 12,
    alignItems: 'center',
    ...tokens.shadow.xs,
  },
  priorityCardSelected: {
    backgroundColor: tokens.color.text,
    borderColor: tokens.color.text,
    ...tokens.shadow.lg,
  },
  priorityLabel: { fontFamily: 'Manrope_700Bold', color: tokens.color.text, fontSize: 13 },
  prioritySla: { fontSize: 11, color: tokens.color.textMuted, marginTop: 2 },

  textArea: {
    backgroundColor: tokens.color.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.color.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
    color: tokens.color.text,
    minHeight: 120,
    textAlignVertical: 'top',
    ...tokens.shadow.xs,
  },

  photoRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  photoCell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: tokens.color.border,
    borderStyle: 'dashed',
    backgroundColor: tokens.color.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  privacy: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: tokens.color.surfaceWarm,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  privacyText: { flex: 1, fontSize: 11, color: tokens.color.textMuted },

  footerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: tokens.color.bg,
  },
  cta: {
    height: 56,
    borderRadius: 24,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.shadow.glow,
  },
  ctaDisabled: { shadowOpacity: 0, elevation: 0 },
  ctaText: { fontFamily: 'Manrope_800ExtraBold', color: '#FFFFFF', fontSize: 16 },
});
