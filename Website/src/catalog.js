// The site's own product cards: colours, drop icon and copy. They are shown
// straight away and stay as the fallback if the live catalog cannot be loaded.
// Their old hard-coded prices were wrong, so there are none here: prices only
// ever come from the server.
//
// A live product takes the look and copy of one of these entries when its slug
// is listed in `slugs`, or when its name starts with the entry's name word for
// word (e.g. "Aqua Imperial Copper 8L" -> "Aqua Imperial Copper"). Anything
// else gets the generic card built from the server's own data.
import { activePrices } from './api';

export const STATIC_PRODUCTS = [
  {
    key: 'ro',
    slugs: ['aqua-imperial-ro'],
    name: 'Aqua Imperial RO',
    tagline: 'Best for renters and budget-friendly plans',
    capacityLitres: 6.5,
    specs: ['Essential minerals', 'Wall-mount or countertop'],
    color: '#0891B2',
    drop: { from: '#67E8F9', to: '#0891B2', mark: 'shine' },
  },
  {
    key: 'copper',
    slugs: ['aqua-imperial-copper'],
    name: 'Aqua Imperial Copper',
    tagline: 'For those chasing the extra immunity boost',
    capacityLitres: 8,
    specs: ['Essential minerals & Copper', 'Wall-mount or countertop'],
    color: '#F59E0B',
    drop: { from: '#FCD34D', to: '#D97706', mark: 'check' },
  },
  {
    key: 'alkaline',
    slugs: ['aqua-imperial-alkaline'],
    name: 'Aqua Imperial Alkaline',
    tagline: 'For those seeking premium health & hydration',
    capacityLitres: 8,
    specs: ['Essential minerals & PH Booster', 'Wall-mount or countertop'],
    color: '#8B5CF6',
    drop: { from: '#C4B5FD', to: '#7C3AED', mark: 'smile' },
  },
  {
    key: 'mineral-plus',
    slugs: ['aqua-imperial-mineral-plus', 'aqua-imperial-mineral'],
    name: 'Aqua Imperial Mineral+',
    tagline: 'Made for low-TDS municipal water',
    capacityLitres: 6.5,
    specs: ['Essential minerals & Copper', 'Wall-mount or countertop'],
    color: '#22C55E',
    drop: { from: '#86EFAC', to: '#16A34A', mark: 'shine' },
  },
];

// Colours for live products that match none of the entries above.
const GENERIC_LOOKS = [
  { color: '#0891B2', drop: { from: '#67E8F9', to: '#0891B2', mark: 'shine' } },
  { color: '#2563EB', drop: { from: '#93C5FD', to: '#2563EB', mark: 'check' } },
  { color: '#0D9488', drop: { from: '#5EEAD4', to: '#0D9488', mark: 'smile' } },
  { color: '#8B5CF6', drop: { from: '#C4B5FD', to: '#7C3AED', mark: 'shine' } },
  { color: '#F59E0B', drop: { from: '#FCD34D', to: '#D97706', mark: 'check' } },
  { color: '#22C55E', drop: { from: '#86EFAC', to: '#16A34A', mark: 'smile' } },
];

const MOUNTING = { WALL: 'Wall-mount', UNDER_SINK: 'Under-sink', COUNTERTOP: 'Countertop' };
const BADGES = { MOST_POPULAR: 'MOST POPULAR', BEST_SELLER: 'BEST SELLER', NEW: 'NEW' };

const capacityText = (litres) => `Storage Tank of ${litres}L Capacity`;

// "Aqua Imperial Mineral+" -> ['aqua', 'imperial', 'mineral', 'plus']
const words = (s) =>
  String(s ?? '').toLowerCase().replace(/\+/g, ' plus ').split(/[^a-z0-9]+/).filter(Boolean);

const startsWithWords = (whole, part) => part.length > 0 && part.every((w, i) => whole[i] === w);

function findStatic(live, taken) {
  const free = STATIC_PRODUCTS.filter((s) => !taken.has(s.key));
  const bySlug = free.find((s) => s.slugs.includes(live.slug));
  if (bySlug) return bySlug;
  const liveWords = words(live.name);
  const byName = free
    .filter((s) => startsWithWords(liveWords, words(s.name)))
    // Longest name wins; on a tie, the one with the same tank size.
    .sort(
      (a, b) =>
        words(b.name).length - words(a.name).length ||
        (b.capacityLitres === live.capacityLitres) - (a.capacityLitres === live.capacityLitres),
    );
  return byName[0] ?? null;
}

function firstSentence(text) {
  const s = String(text ?? '').trim();
  if (!s) return '';
  const m = s.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : s).trim();
}

function genericTagline(p) {
  if (p.personasMin && p.personasMax) return `For homes of ${p.personasMin}–${p.personasMax} people`;
  if (p.kind === 'COMMERCIAL') return 'For offices, shops and institutions';
  return 'Smart RO purifier with servicing included';
}

// Card data for the static entries (before the catalog loads, or if it fails).
export const staticCards = () =>
  STATIC_PRODUCTS.map((s) => ({
    id: s.key,
    name: s.name,
    tagline: s.tagline,
    specs: [capacityText(s.capacityLitres), ...s.specs],
    badge: null,
    color: s.color,
    drop: s.drop,
    live: null,
  }));

// Card data for the live catalog: home purifiers first, then by tank size.
export function liveCards(products) {
  const taken = new Set();
  let generic = 0;
  return [...products]
    .sort(
      (a, b) =>
        (a.kind === 'COMMERCIAL') - (b.kind === 'COMMERCIAL') ||
        (a.capacityLitres ?? 0) - (b.capacityLitres ?? 0) ||
        String(a.name).localeCompare(String(b.name)),
    )
    .map((p) => {
      const match = findStatic(p, taken);
      if (match) taken.add(match.key);
      const look = match ?? GENERIC_LOOKS[generic++ % GENERIC_LOOKS.length];
      const liveSpecs = [
        p.capacityLitres ? capacityText(p.capacityLitres) : null,
        p.technology ? `${p.technology} purification` : null,
        MOUNTING[p.mounting] ?? null,
      ].filter(Boolean);
      return {
        id: p.id,
        name: p.name,
        tagline: match?.tagline || firstSentence(p.description) || genericTagline(p),
        // A matched card keeps its own copy, with the tank size from the server.
        specs: match
          ? [p.capacityLitres ? capacityText(p.capacityLitres) : capacityText(match.capacityLitres), ...match.specs]
          : liveSpecs,
        badge: BADGES[String(p.tag ?? '').toUpperCase()] ?? null,
        color: look.color,
        drop: look.drop,
        live: p,
      };
    });
}

// Cities that have at least one live price, in name order.
export function priceCities(products) {
  const byId = new Map();
  for (const p of products) {
    for (const pr of activePrices(p)) {
      if (pr.city?.id && !byId.has(pr.city.id)) byId.set(pr.city.id, pr.city.name);
    }
  }
  return [...byId].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

// The monthly price to show for a product in a city.
//   'short' -> the 1-month plan
//   'long'  -> the longest plan on sale
// Returns { paise, months } or null if there is no such price.
export function cardPrice(product, cityId, planType) {
  const rows = activePrices(product).filter((pr) => pr.city?.id === cityId || pr.cityId === cityId);
  if (rows.length === 0) return null;
  const row =
    planType === 'short'
      ? rows.find((pr) => pr.plan.durationMonths === 1)
      : rows.reduce(
          (best, pr) =>
            !best ||
            pr.plan.durationMonths > best.plan.durationMonths ||
            (pr.plan.durationMonths === best.plan.durationMonths && pr.monthlyPricePaise < best.monthlyPricePaise)
              ? pr
              : best,
          null,
        );
  return row ? { paise: row.monthlyPricePaise, months: row.plan.durationMonths } : null;
}

// Names for the contact form's "Interested Model" list.
export const staticProductNames = () => STATIC_PRODUCTS.map((s) => s.name);
