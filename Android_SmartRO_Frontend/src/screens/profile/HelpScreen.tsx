// Customer help/support entry point. Surfaces the three competitor-parity
// touchpoints (call, WhatsApp, chat) and records the user's choice as a
// HelpRequest so ops can follow up even when the immediate channel doesn't
// produce a transcript (e.g. the user just taps "call" then hangs up).

import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Headphones, MessageCircle, Phone, HelpCircle } from 'lucide-react-native';
import { Support } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { notify } from '../../utils/confirm';
import { tokens } from '@theme/tokens';
import { Aurora } from '@ui/index';

const SUPPORT_PHONE = '+918800762226';
const SUPPORT_WHATSAPP = '+918800762226';

export function HelpScreen() {
  const [message, setMessage] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [topic, setTopic] = React.useState<'billing' | 'tech' | 'install' | 'cancellation' | 'other'>('other');

  async function open(channel: 'CALL' | 'WHATSAPP' | 'CHAT', target?: string) {
    setBusy(true);
    try {
      await Support.createHelpRequest({ channel, topic });
      if (target) await Linking.openURL(target);
    } catch (e) {
      notify('Could not start support', apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitMessage() {
    if (message.trim().length < 5) return notify('Message', 'Add a short description so we can help faster.');
    setBusy(true);
    try {
      await Support.createHelpRequest({ channel: 'CHAT', topic, message: message.trim() });
      notify('Message sent', 'Our team will get back within a few minutes.');
      setMessage('');
    } catch (e) {
      notify('Could not send', apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <Aurora height={300} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        <Text style={styles.eyebrow}>Support · 9 AM – 7 PM</Text>
        <Text style={styles.heading}>How can we help?</Text>

        <View style={styles.row}>
          <ChannelTile
            icon={<Phone size={20} color={tokens.color.accent} />}
            title="Call us"
            sub={SUPPORT_PHONE}
            onPress={() => open('CALL', `tel:${SUPPORT_PHONE}`)}
          />
          <ChannelTile
            icon={<MessageCircle size={20} color={tokens.color.accent} />}
            title="WhatsApp"
            sub="Avg 3 min reply"
            onPress={() => open('WHATSAPP', `https://wa.me/${SUPPORT_WHATSAPP.replace('+', '')}`)}
          />
        </View>

        <View style={styles.row}>
          <ChannelTile
            icon={<Headphones size={20} color={tokens.color.accent} />}
            title="Live chat"
            sub="In-app"
            onPress={() => open('CHAT')}
          />
          <ChannelTile
            icon={<HelpCircle size={20} color={tokens.color.accent} />}
            title="FAQ"
            sub="Self-serve"
            onPress={() => open('CHAT')}
          />
        </View>

        <Text style={[styles.eyebrow, { marginTop: 24 }]}>Or leave a message</Text>
        <View style={styles.topicRow}>
          {(['billing', 'tech', 'install', 'cancellation', 'other'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTopic(t)}
              style={[styles.topicChip, topic === t && styles.topicChipActive]}
            >
              <Text style={[styles.topicText, topic === t && { color: '#FFFFFF' }]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Tell us what's up…"
          placeholderTextColor={tokens.color.textSubtle}
          multiline
          numberOfLines={4}
          style={styles.textArea}
          selectionColor={tokens.color.accent}
        />
        <Pressable
          onPress={submitMessage}
          disabled={busy}
          style={({ pressed }) => [styles.cta, busy && { opacity: 0.5 }, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.ctaText}>Send message</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function ChannelTile({
  icon, title, sub, onPress,
}: { icon: React.ReactNode; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.9 }]}>
      {icon}
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={styles.tileSub}>{sub}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.color.bg },
  eyebrow: { ...tokens.text.label, color: tokens.color.textMuted, fontSize: 11 },
  heading: { ...tokens.text.displayLg, color: tokens.color.text, marginTop: 4, marginBottom: 16 },
  row: { flexDirection: 'row', gap: 10, marginTop: 10 },
  tile: {
    flex: 1,
    padding: 16,
    borderRadius: 22,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
    gap: 8,
  },
  tileTitle: { fontFamily: 'Manrope_800ExtraBold', color: tokens.color.text, fontSize: 14 },
  tileSub: { ...tokens.text.bodySm, color: tokens.color.textMuted },
  topicRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, marginBottom: 12 },
  topicChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  topicChipActive: { backgroundColor: tokens.color.accent, borderColor: tokens.color.accent },
  topicText: { fontFamily: 'Manrope_700Bold', fontSize: 12, color: tokens.color.text },
  textArea: {
    minHeight: 96,
    padding: 14,
    borderRadius: 18,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
    fontFamily: 'Manrope_400Regular',
    color: tokens.color.text,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  cta: {
    marginTop: 12,
    height: 50,
    borderRadius: 22,
    backgroundColor: tokens.color.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaText: { color: '#FFFFFF', fontFamily: 'Manrope_800ExtraBold', fontSize: 15 },
});
