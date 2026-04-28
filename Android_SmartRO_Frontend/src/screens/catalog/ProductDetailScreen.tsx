import React from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Catalog, PlanCityPrice, Product } from '../../api/endpoints';
import { colors, radius, spacing, type } from '../../theme';
import { paiseToInr } from '../../utils/format';
import { Button } from '../../components/Button';
import type { RootStackParamList } from '../../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ProductDetailScreen({ route }: Props) {
  const navigation = useNavigation<Nav>();
  const { slug, cityId, cityName } = route.params;
  const [product, setProduct] = React.useState<Product | null>(null);
  const [prices, setPrices] = React.useState<PlanCityPrice[]>([]);
  const [selectedPriceId, setSelectedPriceId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    Catalog.product(slug)
      .then(async (p) => {
        if (!alive) return;
        setProduct(p);
        const cityPrices = await Catalog.pricing(p.id, cityId);
        if (!alive) return;
        setPrices(cityPrices);
        setSelectedPriceId(cityPrices[0]?.id ?? null);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [slug, cityId]);

  if (loading || !product) return <Screen><ActivityIndicator color={colors.primary} /></Screen>;

  const selected = prices.find((p) => p.id === selectedPriceId);

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={styles.hero} />
        ) : (
          <View style={[styles.hero, { backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontSize: 80 }}>💧</Text>
          </View>
        )}
        <View style={{ padding: spacing.lg }}>
          <Text style={type.h1}>{product.name}</Text>
          <Text style={{ color: colors.textMuted, marginTop: 4 }}>{product.capacityLitres}L · {product.technology} · {product.mounting}</Text>
          <Text style={{ color: colors.textMuted, marginTop: 4 }}>Available in {cityName}</Text>

          <Text style={[type.h3, { marginTop: spacing.xl }]}>About this purifier</Text>
          <Text style={{ color: colors.text, marginTop: 6, lineHeight: 22 }}>{product.description}</Text>

          <Text style={[type.h3, { marginTop: spacing.xl, marginBottom: spacing.sm }]}>Choose a plan</Text>
          {prices.map((p) => {
            const isSelected = p.id === selectedPriceId;
            const months = Math.round((p.plan?.durationDays ?? 30) / 30);
            return (
              <Pressable key={p.id} onPress={() => setSelectedPriceId(p.id)} style={[styles.planRow, isSelected && styles.planRowSelected]}>
                <View>
                  <Text style={{ fontWeight: '700', fontSize: 15, color: colors.text }}>{p.plan?.name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{months} month{months > 1 ? 's' : ''} · refundable deposit {paiseToInr(p.depositPaise)}</Text>
                </View>
                <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 16 }}>{paiseToInr(p.monthlyPricePaise)}/mo</Text>
              </Pressable>
            );
          })}

          <View style={{ height: spacing.xl }} />
          <Text style={[type.h3]}>What's included</Text>
          {[
            'Free professional installation',
            'All filter replacements (incl. RO membrane)',
            'Routine maintenance every 90 days',
            'On-call breakdown service within 24 hours',
            'No upfront device cost — pay monthly',
          ].map((item, i) => (
            <Text key={i} style={{ color: colors.text, marginTop: 6 }}>✓ {item}</Text>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {selected ? (
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>Total to pay today</Text>
            <Text style={{ fontWeight: '800', fontSize: 18, color: colors.text }}>
              {paiseToInr(selected.monthlyPricePaise + selected.depositPaise)}
            </Text>
          </View>
        ) : <View style={{ flex: 1 }} />}
        <Button
          title="Book now"
          onPress={() => selected && navigation.navigate('Booking', { productId: product.id, planId: selected.planId, cityId })}
          disabled={!selected}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', height: 280 },
  planRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  planRowSelected: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primaryLight },
  footer: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.lg, borderTopWidth: 1, borderColor: colors.border, backgroundColor: '#fff',
  },
});
