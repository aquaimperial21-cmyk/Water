import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { assetUrl } from '../../api/client';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import {
  Bell,
  ChevronRight,
  Star,
  ShieldCheck,
  Wallet,
  Home as HomeIcon,
  Building2,
  ClipboardList,
  UserCheck,
  CreditCard,
  Wrench,
  Check,
  X,
  ArrowRight,
} from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Banners,
  Banner as BannerT,
  Catalog,
  Notifications,
  Product,
  Subscriptions,
  Subscription,
} from '../../api/endpoints';
import { tokens } from '@theme/tokens';
import {
  Aurora,
  Pill,
  ProgressRing,
  SegmentedControl,
  Skeleton,
  WaterDrop,
  WaterDropLogo,
} from '@ui/index';
import { useAuthStore } from '../../store/auth';
import type { RootStackParamList } from '../../navigation';
import { daysFromNow, paiseToInr, formatDate } from '../../utils/format';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Filter = 'HOME' | 'COMMERCIAL';

const TRUST = { rating: 4.8, reviews: 12480, slaHours: 24 };

const TESTIMONIAL = {
  name: 'Ananya R.',
  city: 'Bengaluru',
  text:
    'No filter shopping, no service haggling. ImperialAqua just works — like the water in my taps was always meant to be this clean.',
  rating: 5,
};

const HOW_STEPS = [
  { Icon: ClipboardList, title: 'Book the perfect plan for you', sub: 'Pick a purifier and rental cycle.' },
  { Icon: UserCheck, title: 'Submit your details', sub: 'Address & quick KYC in 2 minutes.' },
  { Icon: CreditCard, title: 'Make the payment', sub: 'UPI, card or net-banking. Refundable deposit only.' },
  { Icon: Wrench, title: 'Get ImperialAqua installed in 48 hours', sub: 'Free pro install. Sip clean water.' },
];

type CompareRow = {
  feature: string;
  ours: string;
  theirs: string;
  advantage: string;
  oursPositive?: boolean;
  theirsPositive?: boolean;
};

const COMPARE_ROWS: CompareRow[] = [
  { feature: 'Machine cost', ours: '₹0', theirs: '₹15,000–₹20,000', advantage: '₹0 machine & installation cost', oursPositive: true, theirsPositive: false },
  { feature: 'Monthly rental plan', ours: 'Present', theirs: 'Absent', advantage: 'Rental plan starting at just ₹349*', oursPositive: true, theirsPositive: false },
  { feature: 'Purification technology', ours: 'RO + UV Lamp', theirs: 'RO + UV LED', advantage: 'Suitable for all types of water', oursPositive: true },
  { feature: 'UV technology', ours: '4 W UV lamp', theirs: '0.7 W in-tank UV LED', advantage: 'High-powered UV lamp', oursPositive: true },
  { feature: 'Copper-impregnated post-carbon', ours: 'Present', theirs: 'Absent', advantage: 'Antimicrobial & health benefits of copper', oursPositive: true, theirsPositive: false },
  { feature: 'Low-pressure operation', ours: 'Present', theirs: 'Absent', advantage: 'No need for an additional pump', oursPositive: true, theirsPositive: false },
  { feature: 'Purification capacity', ours: '15 L / hr', theirs: '12 L / hr', advantage: 'Higher purification capacity', oursPositive: true },
  { feature: 'Water storage capacity', ours: '8 litres', theirs: '6 litres', advantage: 'Higher storage capacity', oursPositive: true },
  { feature: 'Storage tank', ours: 'Transparent', theirs: 'Opaque', advantage: 'Water-level indication for the user', oursPositive: true },
];

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const firstName = user?.fullName?.split(' ')[0] ?? 'there';

  const [filter, setFilter] = React.useState<Filter>('HOME');
  const [products, setProducts] = React.useState<Product[]>([]);
  const [subs, setSubs] = React.useState<Subscription[]>([]);
  const [banners, setBanners] = React.useState<BannerT[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const galleryY = React.useRef(0);
  const scrollRef = React.useRef<ScrollView>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const [ps, ss, bs, ns] = await Promise.all([
        Catalog.products(undefined, filter),
        Subscriptions.mine().catch(() => [] as Subscription[]),
        Banners.list().catch(() => [] as BannerT[]),
        Notifications.mine().catch(() => ({ items: [], unreadCount: 0 })),
      ]);
      setProducts(ps);
      setSubs(ss);
      setBanners(bs);
      setUnread(ns.unreadCount);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useFocusEffect(React.useCallback(() => { void refresh(); }, [refresh]));
  React.useEffect(() => { void refresh(); }, [refresh]);

  const activeSub = subs.find((s) => s.status === 'ACTIVE') ?? subs[0];
  const hasSubscription = !!activeSub;

  const scrollToGallery = () => {
    scrollRef.current?.scrollTo({ y: Math.max(galleryY.current - 12, 0), animated: true });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Aurora height={460} />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Hi, {firstName}</Text>
            <View style={{ marginTop: 2 }}>
              <WaterDropLogo size={28} />
            </View>
          </View>
          <Pressable
            hitSlop={10}
            style={styles.bellBtn}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Bell size={18} color={tokens.color.text} />
            {unread > 0 ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {/* Banner carousel — admin-pushed offers */}
        {banners.length > 0 ? <BannerCarousel banners={banners} /> : null}

        {/* Subscription hero or browse CTA */}
        {hasSubscription ? (
          <SubscriptionHero sub={activeSub!} onManage={() => (navigation as any).navigate('MyPlan')} />
        ) : (
          <BrowseCTA onBrowse={scrollToGallery} />
        )}

        {/* Product gallery */}
        <View
          style={styles.section}
          onLayout={(e) => {
            galleryY.current = e.nativeEvent.layout.y;
          }}
        >
          <View style={styles.sectionHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrowMuted}>Browse purifiers</Text>
              <Text style={styles.sectionTitle}>Built for every space</Text>
            </View>
            <Text style={styles.sectionMeta}>{products.length} models</Text>
          </View>

          <SegmentedControl<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'HOME', label: 'Home', icon: <HomeIcon size={14} color={filter === 'HOME' ? tokens.color.text : tokens.color.textMuted} /> },
              { value: 'COMMERCIAL', label: 'Office', icon: <Building2 size={14} color={filter === 'COMMERCIAL' ? tokens.color.text : tokens.color.textMuted} /> },
            ]}
            style={{ marginTop: 8 }}
          />

          <View style={styles.grid}>
            {loading
              ? [0, 1, 2, 3].map((i) => (
                  <View key={i} style={styles.gridCell}>
                    <View style={styles.skelCard}>
                      <Skeleton height={140} radius={16} />
                      <View style={{ height: 8 }} />
                      <Skeleton width="70%" height={14} />
                      <View style={{ height: 6 }} />
                      <Skeleton width="40%" height={12} />
                    </View>
                  </View>
                ))
              : products.map((p) => (
                  <View key={p.id} style={styles.gridCell}>
                    <ProductCard
                      product={p}
                      onPress={() => navigation.navigate('ProductDetail', { slug: p.slug })}
                    />
                  </View>
                ))}
          </View>
        </View>

        {/* How it works (mt-12) */}
        <MotiView
          from={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 150 }}
          style={styles.section12}
        >
          <Text style={styles.eyebrowMuted}>How it works</Text>
          <Text style={styles.sectionTitle}>
            Get your ImperialAqua in <Text style={{ color: tokens.color.accent }}>4 easy steps</Text>
          </Text>

          <View style={styles.stepsList}>
            {HOW_STEPS.map((s, i) => {
              const Icon = s.Icon;
              const isLast = i === HOW_STEPS.length - 1;
              return (
                <View key={s.title} style={styles.stepRow}>
                  <View style={[styles.stepIconBox, isLast && styles.stepIconBoxLast]}>
                    <LinearGradient
                      colors={
                        isLast
                          ? [tokens.color.success, tokens.color.success]
                          : [tokens.color.gradientDeepFrom, tokens.color.gradientDeepTo]
                      }
                      style={StyleSheet.absoluteFillObject}
                    />
                    <Icon size={20} color="#FFFFFF" />
                    <View style={styles.stepBadge}>
                      <Text style={styles.stepBadgeText}>{i + 1}</Text>
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepLabelTiny}>Step {i + 1}</Text>
                    <Text style={styles.stepTitle}>{s.title}</Text>
                    <Text style={styles.stepSub}>{s.sub}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </MotiView>

        {/* Comparison (mt-12) */}
        <MotiView
          from={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 250 }}
          style={styles.section12}
        >
          <Text style={styles.eyebrowMuted}>Why ImperialAqua</Text>
          <Text style={styles.sectionTitle}>
            How is <Text style={{ color: tokens.color.accent }}>ImperialAqua</Text> better?
          </Text>

          <View style={styles.savings}>
            <LinearGradient
              colors={[tokens.color.gradientDeepFrom, tokens.color.gradientDeepTo]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.savingsLeft}>
              <Text style={styles.savingsLabel}>Save up to</Text>
              <Text style={styles.savingsValue}>50%</Text>
            </View>
            <View style={styles.savingsDivider} />
            <View style={{ flex: 1 }}>
              <Text style={styles.savingsHeading}>By renting, not buying</Text>
              <Text style={styles.savingsBody}>
                Zero upfront. All filters & service included for life.
              </Text>
            </View>
          </View>

          <View style={styles.compareCard}>
            <View style={styles.compareHeadRow}>
              <View style={styles.compareCellHead}>
                <Text style={styles.compareHeadText}>Feature</Text>
              </View>
              <View style={[styles.compareCellHead, styles.compareCellHeadOurs]}>
                <WaterDrop size={16} tone="white" />
                <Text style={[styles.compareHeadText, { color: '#FFFFFF', marginTop: 4 }]}>ImperialAqua</Text>
              </View>
              <View style={styles.compareCellHead}>
                <Text style={styles.compareHeadText}>Other purifiers</Text>
              </View>
            </View>

            {COMPARE_ROWS.map((row, i) => (
              <View key={row.feature}>
                <View
                  style={[
                    styles.compareDataRow,
                    i % 2 === 1 && { backgroundColor: tokens.color.surfaceWarm },
                  ]}
                >
                  <View style={styles.compareCell}>
                    <Text style={styles.compareFeature}>{row.feature}</Text>
                  </View>
                  <View style={[styles.compareCell, { backgroundColor: tokens.color.accentTint }]}>
                    <CompareValue value={row.ours} positive={row.oursPositive} />
                  </View>
                  <View style={styles.compareCell}>
                    <CompareValue value={row.theirs} positive={row.theirsPositive} muted />
                  </View>
                </View>
                <View style={styles.compareAdvantage}>
                  <Check size={12} color={tokens.color.accent} />
                  <Text style={styles.compareAdvantageText}>{row.advantage}</Text>
                </View>
              </View>
            ))}
          </View>
        </MotiView>

        {/* Trust strip (mt-10) */}
        <View style={styles.trust}>
          <View style={styles.trustCell}>
            <View style={styles.trustValueRow}>
              <Star size={14} color={tokens.color.star} fill={tokens.color.star} />
              <Text style={styles.trustValue}>{TRUST.rating}</Text>
            </View>
            <Text style={styles.trustSub}>{TRUST.reviews.toLocaleString('en-IN')}+ reviews</Text>
          </View>
          <View style={styles.trustDivider} />
          <View style={styles.trustCell}>
            <View style={styles.trustValueRow}>
              <ShieldCheck size={14} color={tokens.color.accentGlow} />
              <Text style={styles.trustValue}>{TRUST.slaHours}h</Text>
            </View>
            <Text style={styles.trustSub}>Service SLA</Text>
          </View>
          <View style={styles.trustDivider} />
          <View style={styles.trustCell}>
            <View style={styles.trustValueRow}>
              <Wallet size={14} color={tokens.color.accentGlow} />
              <Text style={styles.trustValue}>₹0</Text>
            </View>
            <Text style={styles.trustSub}>Upfront cost</Text>
          </View>
        </View>

        {/* Testimonial */}
        <View style={styles.testimonial}>
          <View style={styles.starsRow}>
            {Array.from({ length: TESTIMONIAL.rating }).map((_, i) => (
              <Star key={i} size={14} color={tokens.color.star} fill={tokens.color.star} />
            ))}
          </View>
          <Text style={styles.quote}>"{TESTIMONIAL.text}"</Text>
          <Text style={styles.quoteWho}>
            — {TESTIMONIAL.name}, {TESTIMONIAL.city}
          </Text>
        </View>

        <Text style={styles.helpFooter}>Need help? <Text style={{ color: tokens.color.accent, fontFamily: 'Manrope_700Bold' }}>Chat with us</Text></Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/* -------------------- pieces -------------------- */

function BannerCarousel({ banners }: { banners: BannerT[] }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ marginTop: 18, paddingRight: 4, gap: 12 }}
      style={{ marginHorizontal: -20, paddingHorizontal: 20 }}
    >
      {banners.map((b) => (
        <View key={b.id} style={bannerStyles.card}>
          <LinearGradient
            colors={[tokens.color.gradientDeepFrom, tokens.color.gradientDeepTo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Text style={bannerStyles.audience}>{b.audience}</Text>
          <Text style={bannerStyles.title} numberOfLines={2}>{b.title}</Text>
          {b.body ? (
            <Text style={bannerStyles.body} numberOfLines={3}>{b.body}</Text>
          ) : null}
          {b.ctaLabel ? (
            <View style={bannerStyles.cta}>
              <Text style={bannerStyles.ctaText}>{b.ctaLabel}</Text>
              <ArrowRight size={12} color="#FFFFFF" />
            </View>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const bannerStyles = StyleSheet.create({
  card: {
    width: 300,
    minHeight: 144,
    borderRadius: 24,
    padding: 18,
    overflow: 'hidden',
    justifyContent: 'space-between',
    ...tokens.shadow.glow,
  },
  audience: {
    color: 'rgba(255,255,255,0.85)',
    fontFamily: 'Manrope_700Bold',
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    color: '#FFFFFF',
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 18,
    lineHeight: 22,
    marginTop: 6,
  },
  body: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  cta: {
    alignSelf: 'flex-start',
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  ctaText: { color: '#FFFFFF', fontFamily: 'Manrope_800ExtraBold', fontSize: 11 },
});

function SubscriptionHero({ sub, onManage }: { sub: Subscription; onManage: () => void }) {
  const startMs = new Date(sub.startedAt).getTime();
  const endMs = new Date(sub.expiresAt).getTime();
  const now = Date.now();
  const total = Math.max(1, endMs - startMs);
  const remaining = Math.max(0, endMs - now);
  const pct = Math.max(0, Math.min(1, remaining / total));
  const daysLeft = Math.max(0, daysFromNow(sub.expiresAt));
  const productName = sub.product?.name ?? 'Smart RO Plan';
  const serial = sub.device?.serial ?? sub.id.slice(-8).toUpperCase();

  return (
    <View style={styles.heroCard}>
      <View style={styles.heroTop}>
        <LinearGradient
          colors={[tokens.color.gradientDeepFrom, tokens.color.gradientDeepTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.heroTopRow}>
          <Pill tone="ink" dot>Active</Pill>
          <Text style={styles.heroSerial}>{serial}</Text>
        </View>
        <View style={styles.heroBody}>
          <ProgressRing
            progress={pct}
            size={92}
            stroke={8}
            label={String(daysLeft)}
            caption="DAYS"
            pulse={false}
          />
          <View style={{ flex: 1, minWidth: 0, paddingLeft: 12 }}>
            <Text style={styles.heroEyebrow}>Current cycle</Text>
            <Text style={styles.heroProduct} numberOfLines={1}>{productName}</Text>
            <Text style={styles.heroRenews}>Renews {formatDate(sub.expiresAt)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.heroMetaRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.metaTitle}>Filter health</Text>
          <View style={styles.healthBarRow}>
            <View style={styles.healthBarTrack}>
              <View style={[styles.healthBarFill, { width: '78%' }]} />
            </View>
            <Text style={styles.healthValue}>78%</Text>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.metaTitle}>Next service</Text>
          <Text style={styles.metaValueLarge}>{formatDate(new Date(Date.now() + 8 * 86400000))}</Text>
        </View>
      </View>

      <Pressable onPress={onManage} style={styles.manageRow}>
        <Text style={styles.manageText}>Manage subscription</Text>
        <ChevronRight size={16} color={tokens.color.textMuted} />
      </Pressable>
    </View>
  );
}

function BrowseCTA({ onBrowse }: { onBrowse: () => void }) {
  return (
    <View style={[styles.heroCard, { borderColor: tokens.color.accentSoft }]}>
      <View style={styles.browseTop}>
        <Aurora height={260} style={{ position: 'absolute' }} />
        <View style={styles.heroTopRow}>
          <Pill tone="accent" dot>No active plan</Pill>
          <WaterDrop size={32} />
        </View>
        <Text style={styles.browseHeading}>
          Get clean water flowing{'\n'}in 48 hours.
        </Text>
        <Text style={styles.browseSub}>
          Zero upfront cost. All filters, service & installation included.
        </Text>

        <Pressable onPress={onBrowse} style={styles.browseCta}>
          <LinearGradient
            colors={[tokens.color.gradientDeepFrom, tokens.color.gradientDeepTo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Text style={styles.browseCtaText}>Browse Purifiers</Text>
          <ArrowRight size={16} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={styles.browseStats}>
        <View style={styles.browseStatCell}>
          <Text style={styles.browseStatValue}>₹0</Text>
          <Text style={styles.browseStatLabel}>Upfront</Text>
        </View>
        <View style={styles.browseStatDivider} />
        <View style={styles.browseStatCell}>
          <Text style={styles.browseStatValue}>48h</Text>
          <Text style={styles.browseStatLabel}>Install</Text>
        </View>
        <View style={styles.browseStatDivider} />
        <View style={styles.browseStatCell}>
          <Text style={styles.browseStatValue}>∞</Text>
          <Text style={styles.browseStatLabel}>Service</Text>
        </View>
      </View>
    </View>
  );
}

function ProductCard({ product, onPress }: { product: Product; onPress: () => void }) {
  // Prefer the server-side rollup (lowestMonthlyPaise) — it's the cheapest
  // across all cities + plans. Fall back to per-card pricing for back-compat
  // with installs that haven't run the rollup yet.
  const cheapest = product.lowestMonthlyPaise ?? (
    product.prices?.length
      ? product.prices.reduce(
          (min, x) => (x.monthlyPricePaise < min ? x.monthlyPricePaise : min),
          Number.POSITIVE_INFINITY,
        )
      : undefined
  );
  const tagline = product.technology;
  const warranty = Math.max(1, Math.round(product.warrantyMonths / 12));
  const tagLabel =
    product.tag === 'BEST_SELLER' ? 'Best seller'
    : product.tag === 'MOST_POPULAR' ? 'Most popular'
    : product.tag === 'NEW' ? 'New'
    : product.tag === 'TRIAL' ? '7-day trial'
    : null;
  const persona =
    product.personasMin != null && product.personasMax != null
      ? `${product.personasMin}–${product.personasMax} people`
      : null;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.96 }]}>
      <View style={styles.cardImage}>
        <Aurora height={200} style={{ position: 'absolute' }} />
        {product.imageUrl ? (
          <Image
            source={{ uri: assetUrl(product.imageUrl) ?? undefined }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
        ) : (
          <WaterDrop size={64} />
        )}
        {tagLabel ? (
          <View style={[styles.cardCapacityChip, { left: 12, right: 'auto' as any, backgroundColor: tokens.color.accent }]}>
            <Text style={[styles.cardCapacityText, { color: '#FFFFFF' }]}>{tagLabel}</Text>
          </View>
        ) : null}
        <View style={styles.cardCapacityChip}>
          <Text style={styles.cardCapacityText}>{product.capacityLitres} L/hr</Text>
        </View>
        <View style={styles.cardRatingChip}>
          <Star size={10} color={tokens.color.star} fill={tokens.color.star} />
          <Text style={styles.cardRatingText}>4.8</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardTagline} numberOfLines={1}>{tagline}</Text>
        <Text style={styles.cardName} numberOfLines={2}>{product.name}</Text>
        {persona ? <Text style={[styles.cardSubLine, { marginTop: 4 }]}>{persona}</Text> : null}

        <View style={styles.cardPriceRow}>
          <Text style={[styles.cardSubLine, { marginRight: 4 }]}>Starting at</Text>
          <Text style={styles.cardPrice}>
            {Number.isFinite(cheapest as number) ? paiseToInr(cheapest as number) : '—'}
          </Text>
          <Text style={styles.cardPerMo}>/mo</Text>
        </View>
        <Text style={styles.cardSubLine}>{warranty}-year warranty · ₹0 upfront</Text>

        <View style={styles.cardCta}>
          <LinearGradient
            colors={[tokens.color.gradientDeepFrom, tokens.color.gradientDeepTo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Text style={styles.cardCtaText}>Rent Now</Text>
          <ArrowRight size={12} color="#FFFFFF" strokeWidth={2.5} />
        </View>
      </View>
    </Pressable>
  );
}

function CompareValue({
  value,
  positive,
  muted,
}: {
  value: string;
  positive?: boolean;
  muted?: boolean;
}) {
  if (positive === true) {
    return (
      <View style={styles.compareValRow}>
        <Check size={14} color={tokens.color.success} />
        <Text style={[styles.compareValText, { color: tokens.color.success }]}>{value}</Text>
      </View>
    );
  }
  if (positive === false) {
    return (
      <View style={styles.compareValRow}>
        <X size={14} color={tokens.color.danger} />
        <Text style={[styles.compareValText, { color: tokens.color.danger }]}>{value}</Text>
      </View>
    );
  }
  return (
    <Text
      style={[
        styles.compareValText,
        { color: muted ? tokens.color.textMuted : tokens.color.text },
      ]}
    >
      {value}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.color.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 140, paddingTop: 8 },

  // pt-6 flex justify-between
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 24,
  },
  eyebrow: { ...tokens.text.label, color: tokens.color.textSubtle },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.shadow.xs,
  },
  notifDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.color.accent,
    borderWidth: 2,
    borderColor: tokens.color.surface,
  },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: tokens.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: tokens.color.bg,
  },
  bellBadgeText: { color: '#FFFFFF', fontFamily: 'Manrope_800ExtraBold', fontSize: 10 },

  /* Subscription hero — mt-6 rounded-3xl shadow-card overflow-hidden */
  heroCard: {
    marginTop: 24,
    borderRadius: 32,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
    overflow: 'hidden',
    ...tokens.shadow.sm,
  },
  heroTop: { padding: 20, position: 'relative' },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroSerial: { color: 'rgba(255,255,255,0.85)', fontFamily: 'Manrope_700Bold', fontSize: 12, letterSpacing: 0.6 },
  heroBody: { marginTop: 16, flexDirection: 'row', alignItems: 'center' },
  heroEyebrow: { color: 'rgba(255,255,255,0.75)', fontFamily: 'Manrope_700Bold', fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase' },
  heroProduct: { color: '#FFFFFF', fontFamily: 'Manrope_800ExtraBold', fontSize: 18, marginTop: 2 },
  heroRenews: { color: 'rgba(255,255,255,0.85)', fontFamily: 'Manrope_600SemiBold', fontSize: 12, marginTop: 2 },

  heroMetaRow: { flexDirection: 'row', padding: 16, gap: 16 },
  metaTitle: { ...tokens.text.label, color: tokens.color.textSubtle, marginBottom: 6 },
  healthBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  healthBarTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: tokens.color.surfaceMuted, overflow: 'hidden' },
  healthBarFill: { height: 6, backgroundColor: tokens.color.success, borderRadius: 3 },
  healthValue: { fontFamily: 'Manrope_700Bold', color: tokens.color.success, fontSize: 13 },
  metaValueLarge: { fontFamily: 'Manrope_700Bold', color: tokens.color.text, fontSize: 14 },

  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: tokens.color.border,
  },
  manageText: { ...tokens.text.bodySmMedium, color: tokens.color.text, fontFamily: 'Manrope_700Bold' },

  /* Browse CTA */
  browseTop: { padding: 20, position: 'relative' },
  browseHeading: {
    marginTop: 16,
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 22,
    color: tokens.color.text,
    lineHeight: 28,
  },
  browseSub: {
    marginTop: 6,
    ...tokens.text.bodySm,
    color: tokens.color.inkSoft,
  },
  browseCta: {
    marginTop: 16,
    height: 48,
    borderRadius: 18,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...tokens.shadow.glow,
  },
  browseCtaText: { color: '#FFFFFF', fontFamily: 'Manrope_800ExtraBold', fontSize: 15 },
  browseStats: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: tokens.color.border,
  },
  browseStatCell: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  browseStatValue: { fontFamily: 'Manrope_800ExtraBold', fontSize: 16, color: tokens.color.accent },
  browseStatLabel: { ...tokens.text.label, color: tokens.color.textSubtle, fontSize: 10, marginTop: 2 },
  browseStatDivider: { width: 1, backgroundColor: tokens.color.border },

  /* Section common */
  section: { marginTop: 40 },     // mt-10
  section12: { marginTop: 48 },   // mt-12
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 8 },
  eyebrowMuted: { ...tokens.text.label, color: tokens.color.textSubtle },
  sectionTitle: { ...tokens.text.headingLg, color: tokens.color.text, marginTop: 2 },
  sectionMeta: { fontFamily: 'Manrope_700Bold', fontSize: 11, color: tokens.color.textMuted },

  /* Grid */
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, marginHorizontal: -6 },
  gridCell: { width: '50%', padding: 6 },

  // rounded-2xl bg-surface-raised border shadow-soft
  card: {
    borderRadius: 24,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
    overflow: 'hidden',
    ...tokens.shadow.xs,
  },
  // aspect-square grid place-items-center bg-primary-tint
  cardImage: {
    aspectRatio: 1,
    backgroundColor: tokens.color.accentTint,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardCapacityChip: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: tokens.color.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  cardCapacityText: { fontFamily: 'Manrope_700Bold', color: tokens.color.accentInk, fontSize: 10 },
  cardRatingChip: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(14,23,38,0.85)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  cardRatingText: { color: '#FFFFFF', fontFamily: 'Manrope_700Bold', fontSize: 10 },

  cardBody: { padding: 12 },
  cardTagline: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 9.5,
    color: tokens.color.accent,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  cardName: { fontFamily: 'Manrope_700Bold', fontSize: 14, color: tokens.color.text, marginTop: 2, lineHeight: 18 },

  cardPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2, marginTop: 8 },
  cardPrice: { fontFamily: 'Manrope_800ExtraBold', fontSize: 18, color: tokens.color.text },
  cardPerMo: { fontFamily: 'Manrope_400Regular', fontSize: 10, color: tokens.color.textMuted },
  cardSubLine: { fontSize: 10, color: tokens.color.textMuted, marginTop: 1 },

  cardCta: {
    marginTop: 10,
    height: 34,
    borderRadius: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  cardCtaText: { color: '#FFFFFF', fontFamily: 'Manrope_800ExtraBold', fontSize: 12 },

  skelCard: {
    backgroundColor: tokens.color.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: 12,
  },

  /* Steps */
  stepsList: { marginTop: 16, gap: 10 },
  stepRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
    backgroundColor: tokens.color.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: 14,
    ...tokens.shadow.xs,
  },
  stepIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.shadow.glow,
  },
  stepIconBoxLast: {
    shadowColor: tokens.color.success,
  },
  stepBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: tokens.color.text,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: tokens.color.surface,
  },
  stepBadgeText: { color: '#FFFFFF', fontFamily: 'Manrope_700Bold', fontSize: 10 },
  stepLabelTiny: { ...tokens.text.label, fontSize: 10, color: tokens.color.textSubtle },
  stepTitle: { fontFamily: 'Manrope_700Bold', color: tokens.color.text, fontSize: 15, marginTop: 1, lineHeight: 20 },
  stepSub: { ...tokens.text.bodySm, color: tokens.color.textMuted, marginTop: 2 },

  /* Comparison */
  savings: {
    marginTop: 16,
    borderRadius: 18,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
    ...tokens.shadow.glow,
  },
  savingsLeft: { alignItems: 'center' },
  savingsLabel: { color: 'rgba(255,255,255,0.85)', fontFamily: 'Manrope_700Bold', fontSize: 10, letterSpacing: 1.1, textTransform: 'uppercase' },
  savingsValue: { color: '#FFFFFF', fontFamily: 'Manrope_800ExtraBold', fontSize: 32, lineHeight: 32 },
  savingsDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.25)' },
  savingsHeading: { color: '#FFFFFF', fontFamily: 'Manrope_800ExtraBold', fontSize: 15 },
  savingsBody: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },

  compareCard: {
    marginTop: 16,
    borderRadius: 24,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
    overflow: 'hidden',
  },
  compareHeadRow: { flexDirection: 'row' },
  compareCellHead: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: tokens.color.surfaceWarm,
    alignItems: 'center',
  },
  compareCellHeadOurs: { backgroundColor: tokens.color.accent },
  compareHeadText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: tokens.color.textMuted,
    textAlign: 'center',
  },
  compareDataRow: { flexDirection: 'row' },
  compareCell: {
    flex: 1,
    padding: 10,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compareFeature: {
    fontFamily: 'Manrope_700Bold',
    color: tokens.color.text,
    fontSize: 12,
    textAlign: 'center',
  },
  compareValRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  compareValText: { fontFamily: 'Manrope_700Bold', fontSize: 12, textAlign: 'center' },
  compareAdvantage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: tokens.color.accentTint,
    borderTopWidth: 1,
    borderTopColor: tokens.color.accentSoft,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.accentSoft,
  },
  compareAdvantageText: { fontFamily: 'Manrope_700Bold', fontSize: 11, color: tokens.color.accentInk, flex: 1 },

  /* Trust strip — mt-10 rounded-2xl bg-foreground p-4 */
  trust: {
    marginTop: 40,
    flexDirection: 'row',
    backgroundColor: tokens.color.text,
    borderRadius: 24,
    padding: 16,
  },
  trustCell: { flex: 1, alignItems: 'center' },
  trustValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trustValue: { fontFamily: 'Manrope_800ExtraBold', color: '#FFFFFF', fontSize: 18 },
  trustSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 },
  trustDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.12)' },

  /* Testimonial — mt-6 rounded-3xl bg-primary-tint border-primary-soft p-5 */
  testimonial: {
    marginTop: 24,
    backgroundColor: tokens.color.accentTint,
    borderRadius: 32,
    padding: 20,
    borderWidth: 1,
    borderColor: tokens.color.accentSoft,
  },
  starsRow: { flexDirection: 'row', gap: 2 },
  quote: { ...tokens.text.bodyMd, color: tokens.color.accentInk, marginTop: 12, lineHeight: 22, fontFamily: 'Manrope_600SemiBold' },
  quoteWho: { fontFamily: 'Manrope_700Bold', color: 'rgba(10,74,107,0.7)', fontSize: 13, marginTop: 10 },

  helpFooter: { textAlign: 'center', marginTop: 24, ...tokens.text.bodySm, color: tokens.color.textMuted },
});
