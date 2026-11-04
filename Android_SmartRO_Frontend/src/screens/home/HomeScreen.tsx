import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { assetUrl } from '../../api/client';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import {
  Bell,
  ChevronRight,
  ShieldCheck,
  Wallet,
  Home as HomeIcon,
  Building2,
  ClipboardList,
  UserCheck,
  CreditCard,
  Wrench,
  Check,
  ArrowRight,
} from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Banners,
  Banner as BannerT,
  Catalog,
  DeviceHealth,
  DeviceHealthApi,
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
import { reportAppError } from '../../utils/crashReporter';
import type { RootStackParamList } from '../../navigation';
import { paiseToInr, formatDate } from '../../utils/format';
import { planTermLabel } from '../../utils/plans';
import {
  pastPlanSummary,
  pickDefaultSubscription,
  planKind,
  planMonths,
  planView,
} from '../../utils/planState';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Filter = 'HOME' | 'COMMERCIAL';

// Only true facts here: no star ratings or customer quotes until we have
// real ones from real customers.
const TRUST = { slaHours: 24 };

const HOW_STEPS = [
  { Icon: ClipboardList, title: 'Book the perfect plan for you', sub: 'Pick a purifier and rental cycle.' },
  { Icon: UserCheck, title: 'Submit your details', sub: 'Address & quick KYC in 2 minutes.' },
  { Icon: CreditCard, title: 'Make the payment', sub: 'Plan rent upfront + a refundable deposit, securely via Razorpay.' },
  { Icon: Wrench, title: 'Get ImperialAqua installed in 48 hours', sub: 'Free pro install. Sip clean water.' },
];

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const firstName = user?.fullName?.split(' ')[0] ?? 'there';

  const [filter, setFilter] = React.useState<Filter>('HOME');
  const [products, setProducts] = React.useState<Product[]>([]);
  // null until the first successful load: an unknown plan is not "no plan".
  const [subs, setSubs] = React.useState<Subscription[] | null>(null);
  const [health, setHealth] = React.useState<DeviceHealth | null>(null);
  const [banners, setBanners] = React.useState<BannerT[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [now, setNow] = React.useState(() => new Date());
  const galleryY = React.useRef(0);
  const scrollRef = React.useRef<ScrollView>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const [ps, ss, bs, ns, hs] = await Promise.all([
        Catalog.products(undefined, filter).catch(() => null),
        // A failed fetch keeps the last known plans rather than showing "no plan".
        Subscriptions.mine().catch(() => null),
        Banners.list().catch(() => [] as BannerT[]),
        Notifications.mine().catch(() => ({ items: [], unreadCount: 0 })),
        DeviceHealthApi.me().catch(() => null),
      ]);
      // A reply that isn't the expected shape is treated like a failed request.
      if (Array.isArray(ps)) setProducts(ps);
      if (Array.isArray(ss)) setSubs(ss);
      setHealth(hs);
      setBanners(Array.isArray(bs) ? bs : []);
      setUnread(ns?.unreadCount ?? 0);
      setNow(new Date());
    } catch (e) {
      // Failed requests (offline included) are handled above, quietly: this is a bug.
      void reportAppError('promise', e);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useFocusEffect(
    React.useCallback(() => {
      void refresh();
      // Days left and the expired switch move with the clock (as on My Plan).
      const tick = setInterval(() => setNow(new Date()), 60_000);
      return () => clearInterval(tick);
    }, [refresh])
  );
  React.useEffect(() => { void refresh(); }, [refresh]);

  // Same pick as My Plan: running > inactive > expired > closed, newest first.
  const featured = React.useMemo(() => (subs ? pickDefaultSubscription(subs, now) : null), [subs, now]);
  const openPlan = featured && featured.status !== 'CLOSED' ? featured : null;
  // Only closed plans left: no plan, but say when the last one ended.
  const lastPlan = featured && featured.status === 'CLOSED' ? featured : null;

  // The server's EXPIRING segment looks only at the newest plan's end date, so
  // it also matches cancelled plans and ones autopay is about to renew — where
  // a "renew now" offer would mislead or double-charge.
  const renewalDue = (subs ?? []).some(
    (s) => planKind(s, now) === 'expiring' && s.autopayStatus !== 'ACTIVE'
  );
  const visibleBanners = banners.filter((b) => b.audience !== 'EXPIRING' || renewalDue);

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
        {visibleBanners.length > 0 ? <BannerCarousel banners={visibleBanners} /> : null}

        {/* Subscription hero or browse CTA */}
        {openPlan ? (
          <SubscriptionHero
            sub={openPlan}
            now={now}
            health={health}
            onManage={() => (navigation as any).navigate('MyPlan')}
          />
        ) : subs ? (
          <BrowseCTA onBrowse={scrollToGallery} lastPlan={lastPlan} />
        ) : loading ? (
          <View style={[styles.heroCard, { padding: 20 }]}>
            <Skeleton height={92} radius={20} />
          </View>
        ) : null}

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

        {/* Why rent (mt-12) */}
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
                Pay for your plan upfront plus a refundable deposit — filters, service and installation included.
              </Text>
            </View>
          </View>
        </MotiView>

        {/* Trust strip (mt-10) */}
        <View style={styles.trust}>
          <View style={styles.trustCell}>
            <View style={styles.trustValueRow}>
              <Wrench size={14} color={tokens.color.accentGlow} />
              <Text style={styles.trustValue}>Free</Text>
            </View>
            <Text style={styles.trustSub}>Installation</Text>
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
              <Text style={styles.trustValue}>7-day</Text>
            </View>
            <Text style={styles.trustSub}>Full-refund trial</Text>
          </View>
        </View>

        <Text style={styles.helpFooter}>Need help? <Text style={{ color: tokens.color.accent, fontFamily: 'Manrope_700Bold' }}>Chat with us</Text></Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/* -------------------- pieces -------------------- */

/** The banner's targeting code ('ALL', 'CITY:<id>'…) in customer words. */
function audienceLabel(audience: string): string {
  if (audience === 'HOME') return 'For homes';
  if (audience === 'COMMERCIAL') return 'For offices';
  if (audience === 'EXPIRING') return 'Before your plan ends';
  if (audience.startsWith('CITY:')) return 'In your city';
  return 'Offer';
}

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
          <Text style={bannerStyles.audience}>{audienceLabel(b.audience)}</Text>
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

/** Featured open plan (never CLOSED). Every word comes from planView, so it agrees with My Plan. */
function SubscriptionHero({
  sub,
  now,
  health,
  onManage,
}: {
  sub: Subscription;
  now: Date;
  health: DeviceHealth | null;
  onManage: () => void;
}) {
  // autopayAvailable only shapes autopay wording, which this card doesn't show.
  const view = planView(sub, now, { autopayAvailable: null });
  const productName = sub.product?.name ?? 'Smart RO Plan';
  // Only a paired purifier has a serial; before installation there is none.
  const serial = sub.device?.serial ?? null;
  // "Renews on" (autopay on) · "Ends on" · "Ended on".
  const dateRow = view.rows.find((r) => r.key === 'renew' || r.key === 'end');
  const visitRow = view.rows.find((r) => r.key === 'visit');
  // undefined = the server didn't say; null = nothing booked.
  const visitKnown = sub.nextVisit !== undefined;
  // /devices/me/health reports a single purifier (the newest open plan's):
  // trust it only when it is this plan's purifier.
  const reported = serial !== null && health?.serial === serial ? health.filterLifePct : null;
  const filterPct = typeof reported === 'number' && Number.isFinite(reported)
    ? Math.max(0, Math.min(100, Math.round(reported)))
    : null;
  const filterColor = filterPct !== null && filterPct <= 15 ? tokens.color.warn : tokens.color.success;

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
          <Pill tone={view.pill.tone} dot>{view.pill.label}</Pill>
          {serial ? <Text style={styles.heroSerial}>{serial}</Text> : null}
        </View>
        <View style={styles.heroBody}>
          <ProgressRing
            progress={view.ring.progress}
            size={96}
            stroke={8}
            label={view.ring.label}
            caption={view.ring.caption}
            pulse={false}
          />
          <View style={{ flex: 1, minWidth: 0, paddingLeft: 12 }}>
            <Text style={styles.heroEyebrow}>{planTermLabel(planMonths(sub))}</Text>
            <Text style={styles.heroProduct} numberOfLines={1}>{productName}</Text>
            <Text style={styles.heroRenews}>
              {dateRow ? `${dateRow.label} ${dateRow.value}` : view.daysLeftText}
            </Text>
          </View>
        </View>
        <Text style={styles.heroHeadline}>{view.headline}</Text>
      </View>

      {filterPct !== null || visitKnown ? (
        <View style={styles.heroMetaRow}>
          {filterPct !== null ? (
            <View style={{ flex: 1 }}>
              <Text style={styles.metaTitle}>Filter health</Text>
              <View style={styles.healthBarRow}>
                <View style={styles.healthBarTrack}>
                  <View
                    style={[
                      styles.healthBarFill,
                      { width: `${filterPct}%` as `${number}%`, backgroundColor: filterColor },
                    ]}
                  />
                </View>
                <Text style={[styles.healthValue, { color: filterColor }]}>{filterPct}%</Text>
              </View>
            </View>
          ) : null}
          {visitKnown ? (
            <View style={{ flex: 1 }}>
              <Text style={styles.metaTitle}>Next visit</Text>
              <Text style={styles.metaValueLarge} numberOfLines={2}>
                {visitRow ? visitRow.value : 'None scheduled'}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <Pressable onPress={onManage} style={styles.manageRow}>
        <Text style={styles.manageText}>Manage subscription</Text>
        <ChevronRight size={16} color={tokens.color.textMuted} />
      </Pressable>
    </View>
  );
}

function BrowseCTA({ onBrowse, lastPlan }: { onBrowse: () => void; lastPlan: Subscription | null }) {
  // Same end date as My Plan's "Past plans": cancelledAt, else expiresAt.
  const past = lastPlan ? pastPlanSummary(lastPlan) : null;
  const lastEnded = lastPlan
    ? `Your last plan ${lastPlan.cancelledAt ? 'was cancelled' : 'ended'} on ${formatDate(lastPlan.cancelledAt ?? lastPlan.expiresAt)}.`
    : null;

  return (
    <View style={[styles.heroCard, { borderColor: tokens.color.accentSoft }]}>
      <View style={styles.browseTop}>
        <Aurora height={260} style={{ position: 'absolute' }} />
        <View style={styles.heroTopRow}>
          <Pill tone="accent" dot>No active plan</Pill>
          <WaterDrop size={32} />
        </View>
        {lastEnded ? (
          <Text style={styles.browseLast}>
            {lastEnded}
            {past?.refund ? ` ${past.refund}.` : ''}
          </Text>
        ) : null}
        {past?.warning ? <Text style={styles.browseWarn}>{past.warning}</Text> : null}
        <Text style={styles.browseHeading}>
          Get clean water flowing{'\n'}in 48 hours.
        </Text>
        <Text style={styles.browseSub}>
          Pay for your plan upfront plus a refundable deposit — filters, service and installation included.
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
          <Text style={styles.browseStatValue}>48h</Text>
          <Text style={styles.browseStatLabel}>Install</Text>
        </View>
        <View style={styles.browseStatDivider} />
        <View style={styles.browseStatCell}>
          <Text style={styles.browseStatValue}>Included</Text>
          <Text style={styles.browseStatLabel}>Service</Text>
        </View>
        <View style={styles.browseStatDivider} />
        <View style={styles.browseStatCell}>
          <Text style={styles.browseStatValue}>Razorpay</Text>
          <Text style={styles.browseStatLabel}>Secure pay</Text>
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
      ? product.prices
          .reduce(
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
        <Text style={styles.cardSubLine}>{warranty}-year warranty · Service included</Text>

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
  heroHeadline: { color: 'rgba(255,255,255,0.95)', fontFamily: 'Manrope_600SemiBold', fontSize: 13, lineHeight: 18, marginTop: 14 },

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
  browseLast: { marginTop: 14, ...tokens.text.bodySm, color: tokens.color.inkSoft, fontFamily: 'Manrope_600SemiBold' },
  browseWarn: { marginTop: 6, ...tokens.text.bodySm, color: tokens.color.danger, fontFamily: 'Manrope_700Bold' },
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

  helpFooter: { textAlign: 'center', marginTop: 24, ...tokens.text.bodySm, color: tokens.color.textMuted },
});
