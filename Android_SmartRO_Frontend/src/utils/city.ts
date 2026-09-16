// Customer app is not city-aware in the UX, but the backend stores
// per-city pricing. We pick the first serviceable city once and use
// that for pricing + booking under the hood.
import { Catalog, City } from '../api/endpoints';

let cached: City | null = null;
let promise: Promise<City> | null = null;

export async function getDefaultCity(): Promise<City> {
  if (cached) return cached;
  if (!promise) {
    promise = Catalog.cities()
      .then((cs) => {
        const c = cs.find((x) => x.isServiceable) ?? cs[0];
        if (!c) throw new Error('No cities available');
        cached = c;
        return c;
      })
      // Without this, one failed call (a dropped connection on first launch)
      // is cached for the life of the process and every later caller inherits
      // the same rejection — screens that wait on it never recover.
      .catch((e) => {
        promise = null;
        throw e;
      });
  }
  return promise;
}

export function clearCityCache() {
  cached = null;
  promise = null;
}
