import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Bubbles } from '../../components/Bubbles';
import { ProgressRing } from '../../components/ProgressRing';
import { SectionHeader } from '../../components/SectionHeader';
import { SkeletonCard } from '../../components/SkeletonCard';
import { Catalog, Product, Subscriptions, Subscription } from '../../api/endpoints';
import { colors, spacing, type, radius, shadow } from '../../theme';
import { useAuthStore } from '../../store/auth';
import type { RootStackParamList } from '../../navigation';
import { daysFromNow, paiseToInr } from '../../utils/format';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Filter = 'HOME' | 'COMMERCIAL';

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const [filter, setFilter] = React.useState<Filter>('HOME');
  const [products, setProducts] = React.useState<Product[]>([]);
  const [subs, setSubs] = React.useState<Subscription[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const [ps, ss] = await Promise.all([
        Catalog.products(undefined, filter),
        Subscriptions.mine().catch(() => [] as Subscription[]),
      ]);
      setProducts(ps);
      setSubs(ss);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useFocusEffect(React.useCallback(() => { void refresh(); }, [refresh]));
  React.useEffect(() => { void refresh(); }, [refresh]);

  const activeSub = subs.find((s) => s.status === 'ACTIVE') ?? subs[0];
  const daysLeft = activeSub ? Math.max(daysFromNow(activeSub.expiresAt), 0) : 0;
  const ringProgress = Math.max(0, Math.min(1, daysLeft / 180));
  const firstName = user?.fullName?.split(' ')[0] ?? 'there';

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceBright }}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View style={styles.brandIcon}>
            <MaterialIcons name="opacity" size={20} color={colors.onPrimary} />
          </View>
          <Text style={styles.brandText}>SmartRO</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <Pressable hitSlop={10} style={styles.iconBtn}>
            <MaterialIcons name="search" size={22} color={colors.onSurfaceVariant} />
          </Pressable>
          <Pressable hitSlop={10} style={styles.iconBtn}>
            <MaterialIcons name="notifications-none" size={22} color={colors.onSurfaceVariant} />
            <View style={styles.notifDot} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        {/* Greeting hero */}
        <LinearGradient
          colors={[colors.primaryFixed, colors.surfaceContainer]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Bubbles
            bubbles={[
              { size: 220, top: -80, right: -60, color: colors.primary, opacity: 0.06 },
              { size: 90, bottom: -10, left: 30, color: colors.primary, opacity: 0.05 },
            ]}
          />
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>Hi, {firstName} 👋</Text>
              <Text style={styles.heroSub}>Find your perfect water purifier</Text>
            </View>
            <View style={styles.heroAvatar}>
              <Text style={styles.heroAvatarText}>{firstName[0]?.toUpperCase() ?? 'U'}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Active plan card pulled into hero */}
        {activeSub ? (
          <View style={styles.activeCardWrap}>
            <View style={styles.activeCard}>
              <View style={styles.activeAccent} />
              <View style={styles.activeHead}>
                <View style={{ flex: 1 }}>
                  <Badge tone="success" label="ACTIVE" />
                  <Text style={[type.headlineMd, { color: colors.onSurface, marginTop: 6 }]} numberOfLines={1}>
                    {activeSub.product?.name ?? 'Active subscription'}
                  </Text>
                  <Text style={styles.activeSub}>{activeSub.product?.technology ?? 'Smart RO'}</Text>
                </View>
                <View style={styles.devicePic}>
                  <MaterialIcons name="opacity" size={28} color={colors.primary} />
                </View>
              </View>
              <View style={styles.filterRow}>
                <ProgressRing size={48} stroke={4} progress={ringProgress}>
                  <MaterialIcons name="opacity" size={14} color={colors.secondary} />
                </ProgressRing>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={styles.filterTitle}>Filter Life Good</Text>
                  <View style={styles.filterMetrics}>
                    <Text style={styles.filterMetricValue}>{daysLeft}</Text>
                    <Text style={styles.filterMetricLabel}>days until renewal</Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => navigation.navigate('Tabs', { screen: 'MyPlan' } as any)}
                  style={styles.detailBtn}
                >
                  <Text style={styles.detailBtnText}>Details</Text>
                  <MaterialIcons name="arrow-forward" size={14} color={colors.primary} />
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        {/* Filter chips */}
        <View style={styles.filterChipsWrap}>
          <SectionHeader title="Choose your need" caption="What's the purifier for?" style={{ paddingHorizontal: 0, marginBottom: 8 }} />
          <View style={styles.chipsRow}>
            <Chip label="Home use" icon="home" active={filter === 'HOME'} onPress={() => setFilter('HOME')} />
            <Chip label="Commercial" icon="store" active={filter === 'COMMERCIAL'} onPress={() => setFilter('COMMERCIAL')} />
          </View>
        </View>

        {/* Products section */}
        <View style={styles.section}>
          <SectionHeader
            title={filter === 'HOME' ? 'For your home' : 'For your business'}
            caption={loading ? 'Loading...' : `${products.length} purifier${products.length !== 1 ? 's' : ''} available`}
          />

          {loading ? (
            <View style={{ paddingHorizontal: spacing.margin }}>
              <SkeletonCard height={260} />
              <SkeletonCard height={260} />
            </View>
          ) : products.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconBg}>
                <MaterialIcons name="search-off" size={28} color={colors.primary} />
              </View>
              <Text style={[type.titleLg, { color: colors.onSurface, marginTop: 12, fontSize: 16 }]}>
                Nothing here yet
              </Text>
              <Text style={styles.emptyText}>
                No {filter === 'HOME' ? 'home' : 'commercial'} purifiers available right now.
              </Text>
            </View>
          ) : (
            products.map((p) => {
              const cheapest = p.prices?.reduce(
                (min, x) => (x.monthlyPricePaise < min ? x.monthlyPricePaise : min),
                Number.POSITIVE_INFINITY,
              );
              const tech = p.technology.split('+').map((s) => s.trim());
              return (
                <Pressable
                  key={p.id}
                  onPress={() => navigation.navigate('ProductDetail', { slug: p.slug })}
                  style={({ pressed }) => [styles.productCard, pressed && { opacity: 0.96, transform: [{ scale: 0.997 }] }]}
                >
                  <LinearGradient
                    colors={[colors.primaryFixed, colors.surfaceContainerLow]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.productImage}
                  >
                    <Bubbles
                      bubbles={[
                        { size: 100, top: -20, right: -10, color: colors.primary, opacity: 0.08 },
                        { size: 60, bottom: -10, left: 20, color: colors.primary, opacity: 0.06 },
                      ]}
                    />
                    <MaterialIcons name="opacity" size={64} color={colors.primary} />
                    <View style={styles.imageBadgeRow}>
                      <View style={styles.capacityBadge}>
                        <MaterialIcons name="opacity" size={11} color={colors.onPrimary} />
                        <Text style={styles.capacityBadgeText}>{p.capacityLitres}L</Text>
                      </View>
                      {p.kind === 'COMMERCIAL' ? (
                        <View style={styles.commercialBadge}>
                          <MaterialIcons name="store" size={10} color={colors.onPrimary} />
                          <Text style={styles.commercialBadgeText}>Commercial</Text>
                        </View>
                      ) : null}
                    </View>
                  </LinearGradient>

                  <View style={styles.productBody}>
                    <Text style={[type.titleLg, { color: colors.onSurface, fontSize: 17 }]} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={styles.productDesc} numberOfLines={2}>{p.description}</Text>

                    <View style={styles.specRow}>
                      {tech.map((t) => (
                        <View key={t} style={styles.specPill}>
                          <Text style={styles.specText}>{t}</Text>
                        </View>
                      ))}
                      <View style={styles.specPill}>
                        <MaterialIcons name="kitchen" size={11} color={colors.onSurfaceVariant} />
                        <Text style={styles.specText}>{p.mounting.replace('_', ' ').toLowerCase()}</Text>
                      </View>
                    </View>

                    <View style={styles.productFoot}>
                      <View>
                        <Text style={styles.priceFrom}>Starting at</Text>
                        <View style={styles.priceLine}>
                          <Text style={styles.priceValue}>
                            {Number.isFinite(cheapest) ? paiseToInr(cheapest!) : '—'}
                          </Text>
                          <Text style={styles.pricePerMo}>/mo</Text>
                        </View>
                      </View>
                      <View style={styles.bookCta}>
                        <Text style={styles.bookCtaText}>View plans</Text>
                        <MaterialIcons name="arrow-forward" size={16} color={colors.onPrimary} />
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>

        {/* How it works */}
        <View style={styles.section}>
          <SectionHeader title="How it works" caption="Five steps from sign-up to fresh water" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            {[
              { icon: 'touch-app' as const, label: 'Pick a plan', tone: 'primary' as const, num: 1 },
              { icon: 'plumbing' as const, label: 'Free install', tone: 'secondary' as const, num: 2 },
              { icon: 'opacity' as const, label: 'Pure water', tone: 'primary' as const, num: 3 },
              { icon: 'autorenew' as const, label: 'Auto service', tone: 'secondary' as const, num: 4 },
              { icon: 'verified' as const, label: 'Lifetime care', tone: 'primary' as const, num: 5 },
            ].map((s) => (
              <View key={s.label} style={styles.howCard}>
                <View style={styles.howNum}>
                  <Text style={styles.howNumText}>{s.num}</Text>
                </View>
                <View
                  style={[
                    styles.howIcon,
                    { backgroundColor: s.tone === 'primary' ? colors.primaryFixed : 'rgba(86,245,248,0.30)' },
                  ]}
                >
                  <MaterialIcons
                    name={s.icon}
                    size={22}
                    color={s.tone === 'primary' ? colors.primary : colors.secondary}
                  />
                </View>
                <Text style={styles.howLabel}>{s.label}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Why SmartRO */}
        <View style={styles.section}>
          <SectionHeader title="Why SmartRO" caption="Real reviews from happy subscribers" />
          <View style={styles.testimonial}>
            <MaterialIcons
              name="format-quote"
              size={56}
              color={'rgba(0,89,187,0.10)'}
              style={styles.quoteIcon}
            />
            <View style={styles.starsRow}>
              {[0, 1, 2, 3, 4].map((i) => (
                <MaterialIcons key={i} name="star" size={16} color={colors.star} />
              ))}
              <Text style={styles.ratingText}>5.0</Text>
            </View>
            <Text style={styles.testimonialText}>
              "The automated filter change is a game changer. I never have to track it anymore, and the water tastes incredibly fresh."
            </Text>
            <View style={styles.testimonialAuthor}>
              <View style={styles.avatar}>
                <Text style={styles.avatarLetter}>A</Text>
              </View>
              <View>
                <Text style={[type.labelSm, { color: colors.onSurface, fontSize: 12 }]}>Anjali Sharma</Text>
                <Text style={[type.caption, { color: colors.outline }]}>SmartRO subscriber · 8 months</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.margin, marginTop: spacing.lg }}>
          <Button title="Refresh" variant="tonal" size="md" onPress={refresh} fullWidth iconLeft="refresh" />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    height: 56,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(193,198,215,0.4)',
    zIndex: 5,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  brandText: { ...type.titleLg, color: colors.primary },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  notifDot: {
    position: 'absolute',
    top: 10, right: 12,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.error,
    borderWidth: 1.5, borderColor: '#fff',
  },

  hero: {
    paddingHorizontal: spacing.margin,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl + spacing.md,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: 'hidden',
  },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  greeting: { ...type.headlineLg, color: colors.onPrimaryFixed, fontSize: 28 },
  heroSub: { ...type.bodyLg, color: colors.onPrimaryFixedVariant, marginTop: 4, opacity: 0.9, fontSize: 15 },
  heroAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#ffffff',
    alignItems: 'center', justifyContent: 'center',
    ...shadow.sm,
  },
  heroAvatarText: { ...type.headlineMd, color: colors.primary, fontSize: 20 },

  activeCardWrap: { marginTop: -42, paddingHorizontal: spacing.margin, zIndex: 4 },
  activeCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    overflow: 'hidden',
    ...shadow.md,
  },
  activeAccent: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 4,
    backgroundColor: colors.secondary,
  },
  activeHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 4 },
  activeSub: { ...type.bodyMd, color: colors.onSurfaceVariant, marginTop: 2 },
  devicePic: {
    width: 56, height: 56, borderRadius: radius.md,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center', justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    padding: spacing.md, borderRadius: radius.md,
    marginTop: spacing.md,
  },
  filterTitle: { ...type.labelMd, color: colors.onSurface, fontSize: 11 },
  filterMetrics: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 },
  filterMetricValue: { ...type.headlineMd, color: colors.primary, fontSize: 20 },
  filterMetricLabel: { ...type.caption, color: colors.onSurfaceVariant, fontSize: 11 },
  detailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,89,187,0.10)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  detailBtnText: { ...type.labelMd, color: colors.primary, fontSize: 12 },

  filterChipsWrap: { paddingHorizontal: spacing.margin, marginTop: spacing.xl },
  chipsRow: { flexDirection: 'row', gap: spacing.sm },

  section: { marginTop: spacing.xl },

  emptyCard: {
    marginHorizontal: spacing.margin,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  emptyIconBg: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyText: { ...type.bodyMd, color: colors.onSurfaceVariant, textAlign: 'center', marginTop: 4 },

  productCard: {
    marginHorizontal: spacing.margin,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(193,198,215,0.4)',
    ...shadow.sm,
  },
  productImage: {
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  imageBadgeRow: {
    position: 'absolute',
    top: 12, right: 12,
    flexDirection: 'row',
    gap: 6,
  },
  capacityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.secondary,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: radius.full,
  },
  capacityBadgeText: { ...type.labelSm, color: colors.onSecondary, fontSize: 9 },
  commercialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primary,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: radius.full,
  },
  commercialBadgeText: { ...type.labelSm, color: colors.onPrimary, fontSize: 9 },
  productBody: { padding: spacing.md },
  productDesc: { ...type.bodyMd, color: colors.onSurfaceVariant, fontSize: 13, marginTop: 4 },
  specRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  specPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceContainerLow,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.outlineVariant,
  },
  specText: { ...type.caption, color: colors.onSurfaceVariant, fontSize: 11 },
  productFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceVariant,
  },
  priceFrom: { ...type.caption, color: colors.outline, fontSize: 11 },
  priceLine: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  priceValue: { ...type.headlineMd, color: colors.primary, fontSize: 24 },
  pricePerMo: { ...type.caption, color: colors.onSurfaceVariant },
  bookCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: radius.md,
    ...shadow.sm,
  },
  bookCtaText: { ...type.labelMd, color: colors.onPrimary, fontSize: 12 },

  hScroll: { paddingHorizontal: spacing.margin, gap: spacing.md, paddingBottom: 4 },
  howCard: {
    width: 130,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.xl,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(220,227,235,0.5)',
    position: 'relative',
  },
  howNum: {
    position: 'absolute',
    top: 8, right: 8,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#ffffff',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.outlineVariant,
  },
  howNumText: { ...type.labelSm, color: colors.onSurfaceVariant, fontSize: 10 },
  howIcon: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
    marginTop: 8,
  },
  howLabel: { ...type.labelMd, color: colors.onSurface, fontSize: 12, textAlign: 'center' },

  testimonial: {
    marginHorizontal: spacing.margin,
    backgroundColor: 'rgba(0,89,187,0.05)',
    borderColor: 'rgba(0,89,187,0.10)',
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  quoteIcon: { position: 'absolute', top: 4, right: 8 },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: spacing.sm },
  ratingText: { ...type.labelMd, color: colors.onSurface, fontSize: 12, marginLeft: 6 },
  testimonialText: { ...type.bodyMd, color: colors.onSurfaceVariant, fontStyle: 'italic', marginBottom: spacing.md, fontSize: 15 },
  testimonialAuthor: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { ...type.titleMd, color: colors.onPrimary, fontSize: 15 },
});
