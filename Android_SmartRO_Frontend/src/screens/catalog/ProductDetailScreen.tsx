import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { Catalog, PlanCityPrice, Product } from '../../api/endpoints';
import { Bubbles } from '../../components/Bubbles';
import { Button } from '../../components/Button';
import { colors, radius, spacing, type, shadow } from '../../theme';
import { paiseToInr } from '../../utils/format';
import { getDefaultCity } from '../../utils/city';
import type { RootStackParamList } from '../../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ProductDetailScreen({ route, navigation }: Props) {
  const nav = useNavigation<Nav>();
  const { slug } = route.params;
  const [product, setProduct] = React.useState<Product | null>(null);
  const [prices, setPrices] = React.useState<PlanCityPrice[]>([]);
  const [selectedPriceId, setSelectedPriceId] = React.useState<string | null>(null);
  const [cityId, setCityId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const city = await getDefaultCity();
        if (!alive) return;
        setCityId(city.id);
        const p = await Catalog.product(slug);
        if (!alive) return;
        setProduct(p);
        const cityPrices = await Catalog.pricing(p.id, city.id);
        if (!alive) return;
        setPrices(cityPrices);
        setSelectedPriceId(cityPrices[0]?.id ?? null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [slug]);

  if (loading || !product) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBright }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const selected = prices.find((p) => p.id === selectedPriceId);
  const subtotal = selected ? selected.monthlyPricePaise + selected.depositPaise : 0;
  const gst = Math.round(subtotal * 0.18);
  const total = subtotal + gst;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceBright }}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={22} color={colors.onSurfaceVariant} />
        </Pressable>
        <Text style={styles.headerTitle}>Product Detail</Text>
        <Pressable style={styles.iconBtn} hitSlop={8}>
          <MaterialIcons name="favorite-border" size={22} color={colors.onSurfaceVariant} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
        {/* Hero image */}
        <LinearGradient
          colors={[colors.primaryFixed, colors.surfaceContainerLow]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBox}
        >
          <Bubbles
            bubbles={[
              { size: 240, top: -80, right: -60, color: colors.primary, opacity: 0.08 },
              { size: 140, bottom: -40, left: -30, color: colors.primary, opacity: 0.06 },
              { size: 70, top: 30, left: 30, color: colors.primary, opacity: 0.10 },
            ]}
          />
          <MaterialIcons name="opacity" size={140} color={colors.primary} />
          <View style={styles.heroBadge}>
            <MaterialIcons name={product.kind === 'COMMERCIAL' ? 'store' : 'home'} size={12} color={colors.onPrimary} />
            <Text style={styles.heroBadgeText}>{product.kind === 'COMMERCIAL' ? 'Commercial use' : 'Home use'}</Text>
          </View>
          <View style={styles.warrantyChip}>
            <MaterialIcons name="verified" size={12} color={colors.secondary} />
            <Text style={styles.warrantyChipText}>{product.warrantyMonths}-month warranty</Text>
          </View>
          <View style={styles.dotsRow}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.dot, i === 0 ? styles.dotActive : null]} />
            ))}
          </View>
        </LinearGradient>

        {/* Title & rating */}
        <View style={styles.body}>
          <Text style={[type.headlineMd, { color: colors.onSurface }]}>{product.name}</Text>
          <View style={styles.ratingRow}>
            <MaterialIcons name="star" size={16} color={colors.star} />
            <Text style={styles.rating}>4.8</Text>
            <Text style={styles.reviews}>(124 reviews)</Text>
            <Text style={styles.dotSep}>·</Text>
            <MaterialIcons name="verified" size={14} color={colors.secondary} />
            <Text style={styles.warranty}>{product.warrantyMonths}-mo warranty</Text>
          </View>

          {/* Specs grid */}
          <View style={styles.specsGrid}>
            {[
              { icon: 'opacity' as const, label: `${product.capacityLitres}L Capacity` },
              { icon: 'filter-alt' as const, label: product.technology },
              { icon: 'kitchen' as const, label: product.mounting.replace('_', ' ') },
            ].map((s) => (
              <View key={s.label} style={styles.specCell}>
                <MaterialIcons name={s.icon} size={20} color={colors.primary} />
                <Text style={styles.specLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* About */}
          <Text style={styles.sectionTitle}>About this purifier</Text>
          <Text style={styles.description}>{product.description}</Text>

          {/* Plans */}
          <Text style={styles.sectionTitle}>Choose a plan</Text>
          {prices.map((p) => {
            const isSelected = p.id === selectedPriceId;
            const months = Math.max(1, Math.round((p.plan?.durationDays ?? 30) / 30));
            return (
              <Pressable
                key={p.id}
                onPress={() => setSelectedPriceId(p.id)}
                style={[styles.planRow, isSelected && styles.planRowSelected]}
              >
                <View style={[styles.radio, isSelected && styles.radioActive]}>
                  {isSelected ? <View style={styles.radioInner} /> : null}
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={[type.titleMd, { color: colors.onSurface }]}>{p.plan?.name}</Text>
                  <Text style={styles.planMeta}>
                    {months} month{months > 1 ? 's' : ''} · deposit {paiseToInr(p.depositPaise)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[type.titleLg, { color: colors.primary }]}>{paiseToInr(p.monthlyPricePaise)}</Text>
                  <Text style={[type.caption, { color: colors.onSurfaceVariant }]}>per month</Text>
                </View>
              </Pressable>
            );
          })}

          {/* Included */}
          <Text style={styles.sectionTitle}>What's included</Text>
          {[
            'Free professional installation',
            'All filter replacements (incl. RO membrane)',
            'Routine maintenance every 90 days',
            'On-call breakdown service within 24 hours',
            'No upfront device cost — pay monthly',
          ].map((item) => (
            <View key={item} style={styles.includedRow}>
              <View style={styles.checkCircle}>
                <MaterialIcons name="check" size={14} color={colors.onPrimary} />
              </View>
              <Text style={styles.includedText}>{item}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Sticky footer */}
      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          <Text style={styles.footerLabel}>Total to pay today</Text>
          <Text style={styles.footerValue}>{paiseToInr(total)}</Text>
          <Text style={styles.footerHint}>incl. 18% GST</Text>
        </View>
        <Button
          title="Book now"
          iconRight="arrow-forward"
          onPress={() => {
            if (selected && cityId) {
              nav.navigate('Booking', { productId: product.id, planId: selected.planId, cityId });
            }
          }}
          disabled={!selected || !cityId}
        />
      </View>
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
    backgroundColor: colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...type.titleMd, color: colors.onSurface },

  heroBox: {
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  heroBadgeText: { ...type.labelSm, color: colors.onPrimary, fontSize: 10 },
  warrantyChip: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  warrantyChipText: { ...type.labelSm, color: colors.onSurface, fontSize: 10 },
  dotsRow: {
    position: 'absolute',
    bottom: spacing.md,
    left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: colors.primary, width: 24 },

  body: { padding: spacing.lg },

  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, marginBottom: spacing.md, flexWrap: 'wrap' },
  rating: { ...type.bodyMdSemi, color: colors.onSurfaceVariant },
  reviews: { ...type.caption, color: colors.outline },
  dotSep: { color: colors.outline, marginHorizontal: 4 },
  warranty: { ...type.caption, color: colors.secondary, fontFamily: 'Manrope_600SemiBold' },

  specsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.surfaceVariant,
  },
  specCell: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
    borderRadius: radius.md,
    gap: 4,
  },
  specLabel: { ...type.labelSm, color: colors.onSurfaceVariant, fontSize: 11, textAlign: 'center' },

  sectionTitle: { ...type.titleLg, color: colors.onSurface, marginTop: spacing.xl, marginBottom: spacing.sm, fontSize: 18 },
  description: { ...type.bodyMd, color: colors.onSurfaceVariant, lineHeight: 22 },

  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  planRowSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(0,89,187,0.04)',
    ...shadow.sm,
  },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: colors.outline,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: colors.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  planMeta: { ...type.caption, color: colors.onSurfaceVariant, marginTop: 2 },

  includedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  checkCircle: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  includedText: { ...type.bodyMd, color: colors.onSurface, flex: 1 },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.surfaceContainerLowest,
    borderTopWidth: 1,
    borderColor: colors.outlineVariant,
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    ...shadow.lg,
  },
  footerLabel: { ...type.caption, color: colors.outline },
  footerValue: { ...type.titleLg, color: colors.onSurface },
  footerHint: { ...type.caption, color: colors.onSurfaceVariant, fontSize: 11 },
});
