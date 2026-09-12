import React from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { assetUrl } from '../../api/client';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Heart,
  Star,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { Catalog, PlanCityPrice, Product } from '../../api/endpoints';
import { tokens } from '@theme/tokens';
import { Aurora, Pill, Skeleton, WaterDrop } from '@ui/index';
import { paiseToInr } from '../../utils/format';
import { getDefaultCity } from '../../utils/city';
import type { RootStackParamList } from '../../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

type Tab = 'overview' | 'specs' | 'reviews' | 'faq';
const TABS: { value: Tab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'specs', label: 'Specs' },
  { value: 'reviews', label: 'Reviews' },
  { value: 'faq', label: 'FAQ' },
];

const INCLUDED = [
  'Free professional installation in 48h',
  'All filter replacements at no extra cost',
  'Unlimited on-call service visits',
  'TDS & water quality test every quarter',
  'Free relocation, once per year',
];

const FAQS = [
  { q: 'Is there a deposit?', a: 'A small refundable deposit secures the device. It is fully returned when you end your subscription.' },
  { q: 'What if I move cities?', a: 'We support free relocation once per year across all serviceable cities.' },
  { q: 'Who pays for filters?', a: 'We do. Every replacement filter is included for the lifetime of your subscription.' },
  { q: 'How fast is service?', a: 'Most service requests are resolved within 24 hours. Emergencies within 4 hours.' },
];

const REVIEWS = [
  { name: 'Aarav S.', city: 'Bengaluru', rating: 5, text: 'Installed in a day, water tastes incredible. Service team is sharp.' },
  { name: 'Meera K.', city: 'Mumbai', rating: 5, text: 'Zero hassle. Filter changes happen before I even notice.' },
  { name: 'Rohan D.', city: 'Pune', rating: 4, text: 'Quiet, neat, and the app makes everything transparent.' },
];

export function ProductDetailScreen({ route, navigation }: Props) {
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { slug } = route.params;
  const [product, setProduct] = React.useState<Product | null>(null);
  const [prices, setPrices] = React.useState<PlanCityPrice[]>([]);
  const [selectedPriceId, setSelectedPriceId] = React.useState<string | null>(null);
  const [cityId, setCityId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState<Tab>('overview');
  const [favorite, setFavorite] = React.useState(false);
  const [openFaq, setOpenFaq] = React.useState<number | null>(0);
  const scrollY = React.useRef(new Animated.Value(0)).current;

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
        // Pick the 6-month-ish plan if available
        const popular =
          cityPrices.find((c) => Math.round((c.plan?.durationDays ?? 30) / 30) === 6) ?? cityPrices[0];
        setSelectedPriceId(popular?.id ?? null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [slug]);

  const headerOpacity = scrollY.interpolate({
    inputRange: [120, 220],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  if (loading || !product) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          <Skeleton width={64} height={20} />
          <View style={{ height: 16 }} />
          <Skeleton width="100%" height={280} radius={24} />
          <View style={{ height: 24 }} />
          <Skeleton width="60%" height={28} />
          <View style={{ height: 12 }} />
          <Skeleton width="100%" height={16} />
          <Skeleton width="80%" height={16} style={{ marginTop: 6 }} />
        </View>
      </SafeAreaView>
    );
  }

  const selected = prices.find((p) => p.id === selectedPriceId);
  const subtotal = selected ? selected.monthlyPricePaise + selected.depositPaise : 0;

  const warrantyYrs = Math.max(1, Math.round(product.warrantyMonths / 12));
  const mountingLabel = product.mounting
    ? product.mounting.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())
    : 'Countertop';
  const specs = [
    { label: 'Technology', value: product.technology },
    { label: 'Mounting', value: mountingLabel },
    { label: 'Throughput', value: `${product.capacityLitres} L/hr` },
    { label: 'Tank', value: `${Math.max(6, Math.round(product.capacityLitres * 0.7))} L` },
    { label: 'Use case', value: product.kind === 'COMMERCIAL' ? 'Office / commercial' : 'Home use' },
    { label: 'Warranty', value: `${warrantyYrs} year${warrantyYrs > 1 ? 's' : ''}` },
  ];

  return (
    <View style={styles.root}>
      <Aurora height={420} />

      {/* Floating top bar */}
      <SafeAreaView style={styles.topBarWrap} edges={['top']} pointerEvents="box-none">
        <Animated.View
          style={[styles.topBarSticky, { opacity: headerOpacity }]}
          pointerEvents="none"
        />
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} hitSlop={10}>
            <ArrowLeft size={18} color={tokens.color.text} />
          </Pressable>
          <Animated.Text style={[styles.topBarTitle, { opacity: headerOpacity }]} numberOfLines={1}>
            {product.name}
          </Animated.Text>
          <Pressable onPress={() => setFavorite((f) => !f)} style={styles.iconBtn} hitSlop={10}>
            <Heart
              size={18}
              color={favorite ? tokens.color.danger : tokens.color.text}
              fill={favorite ? tokens.color.danger : 'transparent'}
            />
          </Pressable>
        </View>
      </SafeAreaView>

      <Animated.ScrollView
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 200,
          paddingTop: insets.top + 56,
          paddingHorizontal: 20,
        }}
      >
        {/* Hero — h-72 rounded-3xl bg-primary-tint with aurora overlay */}
        <MotiView
          from={{ opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 320 }}
          style={styles.hero}
        >
          <Aurora height={300} style={{ position: 'absolute' }} />
          {product.imageUrl ? (
            <Image
              source={{ uri: assetUrl(product.imageUrl) ?? undefined }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
          ) : (
            <MotiView
              from={{ scale: 0.92, opacity: 0.9 }}
              animate={{ scale: 1.04, opacity: 1 }}
              transition={{ type: 'timing', duration: 1800, loop: true, repeatReverse: true }}
            >
              <WaterDrop size={150} />
            </MotiView>
          )}
          <View style={[styles.heroChip, { left: 16, top: 16 }]}>
            <Pill tone="accent">{product.kind === 'COMMERCIAL' ? 'For offices' : 'For homes'}</Pill>
          </View>
          <View style={[styles.heroChip, { right: 16, top: 16 }]}>
            <Pill tone="ink">{warrantyYrs}-year warranty</Pill>
          </View>
        </MotiView>

        {/* Title */}
        <Text style={styles.tagline}>{product.technology}</Text>
        <Text style={styles.title}>{product.name}</Text>
        <View style={styles.ratingRow}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} size={13} color={tokens.color.star} fill={tokens.color.star} />
          ))}
          <Text style={styles.ratingValue}> 4.8</Text>
          <Text style={styles.ratingMeta}>· 1,284 reviews</Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabsRow}>
          {TABS.map((t) => {
            const active = t.value === tab;
            return (
              <Pressable key={t.value} onPress={() => setTab(t.value)} style={styles.tabBtn}>
                <Text style={[styles.tabLabel, active && { color: tokens.color.text }]}>
                  {t.label}
                </Text>
                {active ? <View style={styles.tabUnderline} /> : null}
              </Pressable>
            );
          })}
        </View>

        {/* Tab body */}
        <View style={{ marginTop: 16 }}>
          {tab === 'overview' ? (
            <>
              <Text style={styles.bodyText}>
                {product.description ||
                  'A premium under-the-sink purifier engineered for Indian water. Seven stages of filtration restore essential minerals while removing TDS up to 2000 ppm.'}
              </Text>
              <View style={styles.specMini}>
                {specs.slice(0, 3).map((s) => (
                  <View key={s.label} style={styles.specMiniCell}>
                    <Text style={styles.specLabel}>{s.label}</Text>
                    <Text style={styles.specValue}>{s.value}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {tab === 'specs' ? (
            <View style={styles.specsCard}>
              {specs.map((s, i) => (
                <View
                  key={s.label}
                  style={[
                    styles.specRow,
                    i < specs.length - 1 && styles.specRowDivider,
                  ]}
                >
                  <Text style={styles.specRowLabel}>{s.label}</Text>
                  <Text style={styles.specRowValue}>{s.value}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {tab === 'reviews' ? (
            <View style={{ gap: 12 }}>
              {REVIEWS.map((r, i) => (
                <View key={i} style={styles.reviewCard}>
                  <View style={styles.reviewHead}>
                    <View style={styles.reviewAvatar}>
                      <Text style={styles.reviewInitial}>{r.name[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reviewName}>{r.name}</Text>
                      <Text style={styles.reviewCity}>{r.city}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 1 }}>
                      {Array.from({ length: r.rating }).map((_, j) => (
                        <Star
                          key={j}
                          size={12}
                          color={tokens.color.star}
                          fill={tokens.color.star}
                        />
                      ))}
                    </View>
                  </View>
                  <Text style={styles.reviewText}>{r.text}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {tab === 'faq' ? (
            <View style={styles.faqCard}>
              {FAQS.map((f, i) => {
                const open = openFaq === i;
                return (
                  <Pressable
                    key={i}
                    onPress={() => setOpenFaq(open ? null : i)}
                    style={[
                      styles.faqRow,
                      i < FAQS.length - 1 && styles.faqRowDivider,
                    ]}
                  >
                    <View style={styles.faqHead}>
                      <Text style={styles.faqQ}>{f.q}</Text>
                      <ChevronDown
                        size={16}
                        color={tokens.color.textMuted}
                        style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
                      />
                    </View>
                    {open ? <Text style={styles.faqA}>{f.a}</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>

        {/* Plan picker — 2-step tenure toggle in DrinkPrime style. */}
        <PlanPicker
          prices={prices}
          selectedPriceId={selectedPriceId}
          onSelect={setSelectedPriceId}
        />

        {/* Included */}
        <View style={styles.includedCard}>
          <Text style={styles.sectionEyebrow}>What's included</Text>
          <Text style={styles.sectionTitle}>Every month, no extras</Text>
          <View style={{ marginTop: 12, gap: 10 }}>
            {INCLUDED.map((item) => (
              <View key={item} style={styles.includedRow}>
                <View style={styles.includedDot}>
                  <Check size={11} color={tokens.color.success} strokeWidth={3} />
                </View>
                <Text style={styles.includedText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      </Animated.ScrollView>

      {/* Sticky footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.footerCard}>
          <View style={{ paddingHorizontal: 4 }}>
            <Text style={styles.footerLabel}>Today's bill</Text>
            <Text style={styles.footerValue}>{paiseToInr(subtotal)}</Text>
          </View>
          <Pressable
            onPress={() => {
              if (selected && cityId) {
                nav.navigate('Booking', {
                  productId: product.id,
                  planId: selected.planId,
                  cityId,
                });
              }
            }}
            style={({ pressed }) => [styles.bookCta, pressed && { opacity: 0.95 }]}
          >
            <LinearGradient
              colors={[tokens.color.gradientAccentFrom, tokens.color.gradientAccentTo]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Text style={styles.bookCtaText}>Book installation</Text>
            <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.4} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/* ──────────────────────────────────────────────────────────────
   PlanPicker — 2-step tenure toggle inspired by competitor UX.
   Step 1: pill row of tenures (sorted by duration).
   Step 2: highlight card showing /mo price, savings, deposit, lock-in.
   ────────────────────────────────────────────────────────────── */
function PlanPicker({
  prices,
  selectedPriceId,
  onSelect,
}: {
  prices: PlanCityPrice[];
  selectedPriceId: string | null;
  onSelect: (id: string) => void;
}) {
  if (!prices.length) return null;

  // Sort by duration ascending so Monthly is leftmost.
  const sorted = [...prices].sort(
    (a, b) => (a.plan?.durationDays ?? 30) - (b.plan?.durationDays ?? 30)
  );
  const monthly = sorted[0];
  const selected = sorted.find((p) => p.id === selectedPriceId) ?? sorted[0];
  const months = Math.max(1, Math.round((selected.plan?.durationDays ?? 30) / 30));

  // Savings vs the monthly (shortest) plan, computed per /mo and over the cycle.
  const baseMonthly = monthly.monthlyPricePaise;
  const savePerMonth = Math.max(0, baseMonthly - selected.monthlyPricePaise);
  const totalSave = savePerMonth * months;
  const savePct = baseMonthly > 0 ? Math.round((savePerMonth / baseMonthly) * 100) : 0;

  // Pick a "most popular" — the longest plan with a real discount, else 6mo.
  // (Manual reverse-find so we don't depend on Array.prototype.findLast,
  //  which isn't available on every Hermes / older browser yet.)
  let popularId: string | null = null;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].monthlyPricePaise < baseMonthly) {
      popularId = sorted[i].id;
      break;
    }
  }
  if (!popularId) {
    const sixMo = sorted.find((p) => Math.round((p.plan?.durationDays ?? 30) / 30) === 6);
    popularId = sixMo?.id ?? null;
  }

  return (
    <View style={{ marginTop: 32 }}>
      <Text style={styles.sectionEyebrow}>Pick a plan</Text>
      <Text style={styles.sectionTitle}>Choose your tenure</Text>

      {/* Step 1 — tenure pills */}
      <View style={pickerStyles.pillRow}>
        {sorted.map((p) => {
          const isSel = p.id === selected.id;
          const m = Math.max(1, Math.round((p.plan?.durationDays ?? 30) / 30));
          const label = m === 1 ? 'Monthly' : m === 12 ? 'Annual' : `${m} months`;
          const sub = `${p.plan?.durationDays ?? 30} days`;
          const isPop = popularId === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => onSelect(p.id)}
              style={[pickerStyles.pill, isSel && pickerStyles.pillActive]}
            >
              {isPop && !isSel ? (
                <View style={pickerStyles.popular}>
                  <Text style={pickerStyles.popularText}>POPULAR</Text>
                </View>
              ) : null}
              <Text
                style={[pickerStyles.pillLabel, isSel && pickerStyles.pillLabelActive]}
                numberOfLines={1}
              >
                {label}
              </Text>
              <Text
                style={[pickerStyles.pillSub, isSel && pickerStyles.pillSubActive]}
                numberOfLines={1}
              >
                {sub}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Step 2 — selected price + savings */}
      <View style={pickerStyles.priceCard}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 }}>
          <Text style={pickerStyles.priceValue}>{paiseToInr(selected.monthlyPricePaise)}</Text>
          <Text style={pickerStyles.pricePer}>/month</Text>
          {savePct > 0 ? (
            <View style={pickerStyles.saveBadge}>
              <Text style={pickerStyles.saveBadgeText}>
                {savePct}% off · save {paiseToInr(totalSave)}
              </Text>
            </View>
          ) : (
            <View style={pickerStyles.saveBadgeFlat}>
              <Text style={pickerStyles.saveBadgeFlatText}>0% discount</Text>
            </View>
          )}
        </View>
        <Text style={pickerStyles.priceMeta}>
          {selected.depositPaise === 0
            ? 'Refundable deposit waived'
            : `Refundable deposit ${paiseToInr(selected.depositPaise)}`}
          {' · '}
          {months}-month lock-in
        </Text>
      </View>

      {/* Promo hint — kept generic; admin can later push offers via banners */}
      <View style={pickerStyles.promo}>
        <Text style={pickerStyles.promoIcon}>%</Text>
        <Text style={pickerStyles.promoText} numberOfLines={2}>
          Use code <Text style={{ fontFamily: 'Manrope_800ExtraBold' }}>FLAT100</Text> at checkout to save up to ₹100 more.
        </Text>
      </View>
    </View>
  );
}

const pickerStyles = StyleSheet.create({
  pillRow: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    minWidth: 110,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface,
    alignItems: 'center',
    position: 'relative',
  },
  pillActive: {
    borderColor: tokens.color.accent,
    backgroundColor: tokens.color.accentTint,
  },
  pillLabel: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 14,
    color: tokens.color.text,
  },
  pillLabelActive: { color: tokens.color.accentInk },
  pillSub: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11,
    color: tokens.color.textMuted,
    marginTop: 2,
  },
  pillSubActive: { color: tokens.color.accentInk, opacity: 0.85 },
  popular: {
    position: 'absolute',
    top: -8,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: tokens.color.warn,
  },
  popularText: {
    color: '#FFFFFF',
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 9,
    letterSpacing: 0.6,
  },

  priceCard: {
    marginTop: 16,
    backgroundColor: tokens.color.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: 16,
    ...tokens.shadow.xs,
  },
  priceValue: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 32,
    lineHeight: 36,
    color: tokens.color.success,
  },
  pricePer: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 14,
    color: tokens.color.textMuted,
  },
  saveBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: tokens.color.successSoft,
    marginLeft: 'auto',
  },
  saveBadgeText: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 11,
    color: tokens.color.success,
  },
  saveBadgeFlat: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: tokens.color.surfaceWarm,
    marginLeft: 'auto',
  },
  saveBadgeFlatText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    color: tokens.color.textMuted,
  },
  priceMeta: {
    marginTop: 8,
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 12,
    color: tokens.color.textMuted,
  },

  promo: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: tokens.color.successSoft,
    borderWidth: 1,
    borderColor: tokens.color.success,
    borderStyle: 'dashed',
  },
  promoIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: tokens.color.success,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 26,
    fontFamily: 'Manrope_800ExtraBold',
  },
  promoText: {
    flex: 1,
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 13,
    color: tokens.color.success,
  },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.color.bg },

  topBarWrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30 },
  topBarSticky: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(250,248,245,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.border,
  },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  topBarTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Manrope_700Bold',
    fontSize: 14,
    color: tokens.color.text,
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

  // h-72 rounded-3xl bg-primary-tint border border-primary-soft
  hero: {
    height: 288,
    borderRadius: 32,
    backgroundColor: tokens.color.accentTint,
    borderWidth: 1,
    borderColor: tokens.color.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroChip: { position: 'absolute' },

  tagline: {
    marginTop: 18,
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    color: tokens.color.accent,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: { ...tokens.text.displayMd, color: tokens.color.text, marginTop: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 2 },
  ratingValue: { ...tokens.text.bodySmMedium, color: tokens.color.text, fontFamily: 'Manrope_700Bold' },
  ratingMeta: { ...tokens.text.bodySm, color: tokens.color.textMuted, marginLeft: 4 },

  tabsRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 24,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.border,
  },
  tabBtn: { paddingHorizontal: 12, paddingVertical: 12, position: 'relative' },
  tabLabel: { fontFamily: 'Manrope_700Bold', fontSize: 13, color: tokens.color.textMuted },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    right: 8,
    height: 2,
    backgroundColor: tokens.color.accent,
    borderRadius: 1,
  },

  bodyText: { ...tokens.text.bodyMd, color: tokens.color.inkSoft, lineHeight: 22 },
  specMini: { flexDirection: 'row', gap: 8, marginTop: 16 },
  specMiniCell: {
    flex: 1,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: 18,
    paddingVertical: 12,
    alignItems: 'center',
    ...tokens.shadow.xs,
  },
  specLabel: { ...tokens.text.label, color: tokens.color.textSubtle, fontSize: 9.5 },
  specValue: { fontFamily: 'Manrope_700Bold', fontSize: 14, color: tokens.color.text, marginTop: 2 },

  specsCard: {
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: 20,
    overflow: 'hidden',
    ...tokens.shadow.xs,
  },
  specRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  specRowDivider: { borderBottomWidth: 1, borderBottomColor: tokens.color.border },
  specRowLabel: { ...tokens.text.bodySm, color: tokens.color.textMuted },
  specRowValue: { fontFamily: 'Manrope_700Bold', color: tokens.color.text, fontSize: 14 },

  reviewCard: {
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: 20,
    padding: 14,
    ...tokens.shadow.xs,
  },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.color.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewInitial: { color: tokens.color.accentInk, fontFamily: 'Manrope_700Bold' },
  reviewName: { fontFamily: 'Manrope_700Bold', color: tokens.color.text, fontSize: 13 },
  reviewCity: { ...tokens.text.caption, color: tokens.color.textMuted },
  reviewText: { ...tokens.text.bodySm, color: tokens.color.inkSoft, marginTop: 8 },

  faqCard: {
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: 20,
    overflow: 'hidden',
    ...tokens.shadow.xs,
  },
  faqRow: { paddingHorizontal: 16, paddingVertical: 14 },
  faqRowDivider: { borderBottomWidth: 1, borderBottomColor: tokens.color.border },
  faqHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  faqQ: { fontFamily: 'Manrope_700Bold', color: tokens.color.text, fontSize: 13, flex: 1, marginRight: 12 },
  faqA: { ...tokens.text.bodySm, color: tokens.color.textMuted, marginTop: 8 },

  sectionEyebrow: { ...tokens.text.label, color: tokens.color.textSubtle },
  sectionTitle: { ...tokens.text.headingLg, color: tokens.color.text, marginTop: 2 },

  planCard: {
    width: 220,
    borderRadius: 24,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: 16,
    ...tokens.shadow.xs,
  },
  planCardSelected: {
    backgroundColor: tokens.color.text,
    borderColor: tokens.color.text,
    ...tokens.shadow.lg,
  },
  planTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planMonths: { fontFamily: 'Manrope_700Bold', fontSize: 11, color: tokens.color.textMuted, letterSpacing: 1.2 },
  planRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: tokens.color.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planRadioSelected: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  planPrice: {
    marginTop: 12,
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 28,
    color: tokens.color.text,
  },
  planPer: { ...tokens.text.caption, color: tokens.color.textMuted, marginTop: 2 },
  planDivider: { height: 1, backgroundColor: tokens.color.border, marginVertical: 12 },
  planDeposit: { fontSize: 12, color: tokens.color.textMuted, fontFamily: 'Manrope_600SemiBold' },
  planPopular: {
    position: 'absolute',
    top: -8,
    right: 16,
    backgroundColor: tokens.color.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    ...tokens.shadow.glow,
  },
  planPopularText: { color: '#FFFFFF', fontFamily: 'Manrope_800ExtraBold', fontSize: 9, letterSpacing: 0.6 },

  includedCard: {
    marginTop: 32,
    borderRadius: 28,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: 18,
    ...tokens.shadow.sm,
  },
  includedRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  includedDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: tokens.color.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  includedText: { flex: 1, ...tokens.text.bodySm, color: tokens.color.inkSoft },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: tokens.color.bg,
  },
  footerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: tokens.color.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: 12,
    ...tokens.shadow.lg,
  },
  footerLabel: { ...tokens.text.label, color: tokens.color.textSubtle, fontSize: 9.5 },
  footerValue: { fontFamily: 'Manrope_800ExtraBold', fontSize: 18, color: tokens.color.text },
  bookCta: {
    marginLeft: 'auto',
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 14,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...tokens.shadow.glow,
  },
  bookCtaText: { color: '#FFFFFF', fontFamily: 'Manrope_800ExtraBold', fontSize: 14 },

  footerMeta: { ...tokens.text.caption, color: tokens.color.textMuted },
});
