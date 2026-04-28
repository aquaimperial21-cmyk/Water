import React from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Catalog, Product } from '../../api/endpoints';
import { colors, radius, spacing, type } from '../../theme';
import type { RootStackParamList } from '../../navigation';
import { paiseToInr } from '../../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Catalog'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export function CatalogScreen({ route }: Props) {
  const { cityId, cityName } = route.params;
  const navigation = useNavigation<Nav>();
  const [filter, setFilter] = React.useState<'ALL' | 'HOME' | 'COMMERCIAL'>('ALL');
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    Catalog.products(cityId, filter === 'ALL' ? undefined : filter)
      .then((p) => { if (alive) { setProducts(p); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [cityId, filter]);

  return (
    <Screen padded={false}>
      <View style={styles.tabs}>
        {(['ALL', 'HOME', 'COMMERCIAL'] as const).map((k) => (
          <Pressable key={k} onPress={() => setFilter(k)} style={[styles.tab, filter === k && styles.tabActive]}>
            <Text style={[styles.tabLabel, filter === k && styles.tabLabelActive]}>{k}</Text>
          </Pressable>
        ))}
      </View>
      {loading ? (
        <View style={styles.loader}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: spacing.lg }}
          ListEmptyComponent={<Text style={{ textAlign: 'center', color: colors.textMuted, marginTop: 80 }}>No products available in {cityName} yet.</Text>}
          renderItem={({ item }) => {
            const cheapest = item.prices?.reduce((min, p) => (p.monthlyPricePaise < min ? p.monthlyPricePaise : min), Number.POSITIVE_INFINITY);
            return (
              <Pressable
                onPress={() => navigation.navigate('ProductDetail', { slug: item.slug, cityId, cityName })}
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
              >
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.image} />
                ) : (
                  <View style={[styles.image, styles.imagePlaceholder]}><Text style={{ fontSize: 32 }}>💧</Text></View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[type.h3, { color: colors.text }]}>{item.name}</Text>
                  <Text style={styles.spec}>{item.capacityLitres}L · {item.technology}</Text>
                  <Text style={styles.spec}>Mounting: {item.mounting}</Text>
                  {Number.isFinite(cheapest) ? (
                    <Text style={styles.price}>From {paiseToInr(cheapest!)} / mo</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', padding: spacing.lg, gap: spacing.sm },
  tab: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabLabel: { color: colors.text, fontSize: 13, fontWeight: '600' },
  tabLabelActive: { color: '#fff' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  image: { width: 90, height: 110, borderRadius: radius.md, backgroundColor: colors.primaryLight },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  spec: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  price: { color: colors.primary, fontWeight: '700', marginTop: 8, fontSize: 14 },
});
