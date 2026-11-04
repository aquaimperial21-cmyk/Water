// Prices and technicians differ per city, so the customer picks their city
// (on the product page) and the choice is saved on the phone. Nothing falls
// back to "the first city" any more: a Pune customer used to be priced and
// booked as Mumbai without ever being asked.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Catalog, City } from '../api/endpoints';

const CITY_KEY = 'smartro.cityId';

let citiesPromise: Promise<City[]> | null = null;

/** Cities we install in (the server lists serviceable ones only). */
export function getCities(): Promise<City[]> {
  if (!citiesPromise) {
    citiesPromise = Catalog.cities()
      .then((cs) => {
        const list = cs.filter((c) => c.isServiceable);
        if (!list.length) throw new Error('No cities available');
        return list;
      })
      // Without this, one failed call (a dropped connection on first launch)
      // is cached for the life of the process and every later caller inherits
      // the same rejection — screens that wait on it never recover.
      .catch((e) => {
        citiesPromise = null;
        throw e;
      });
  }
  return citiesPromise;
}

/**
 * The customer's city: the one they picked before, or the only city if we
 * serve just one. null means "ask them".
 */
export async function getChosenCity(): Promise<City | null> {
  const cities = await getCities();
  let savedId: string | null = null;
  try {
    savedId = await AsyncStorage.getItem(CITY_KEY);
  } catch {
    // Storage unavailable: treat as not chosen yet.
  }
  return cities.find((c) => c.id === savedId) ?? (cities.length === 1 ? cities[0] : null);
}

export async function saveChosenCity(city: City): Promise<void> {
  try {
    await AsyncStorage.setItem(CITY_KEY, city.id);
  } catch {
    // Not fatal: they'll be asked again next time.
  }
}

export function clearCityCache() {
  citiesPromise = null;
}
