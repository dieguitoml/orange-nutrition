import type { UserPreferences } from '../../core/types/domain';
import { userPreferencesSchema } from '../../core/validation/schemas';
import { nowIso } from '../../core/utils/dates';
import { getDb, guard } from '../db';

export function defaultPreferences(): UserPreferences {
  return {
    id: 'user',
    diets: [],
    allergies: [],
    dislikedFoodIds: [],
    dislikedKeywords: [],
    favoriteFoodIds: [],
    favoriteRecipeIds: [],
    availableIngredientIds: [],
    weekStartsOn: 1,
    unitSystem: 'metric',
    updatedAt: nowIso(),
  };
}

export const preferencesRepository = {
  /** Stored preferences, or defaults (not persisted) when none exist. */
  async get(): Promise<UserPreferences> {
    return guard('Get preferences', async () => (await getDb().preferences.get('user')) ?? defaultPreferences());
  },
  async put(prefs: UserPreferences): Promise<UserPreferences> {
    return guard('Save preferences', async () => {
      const p = userPreferencesSchema.parse({ ...prefs, updatedAt: nowIso() }) as UserPreferences;
      await getDb().preferences.put(p);
      return p;
    });
  },
  /** Read-modify-write inside a transaction. */
  async update(mutator: (p: UserPreferences) => UserPreferences): Promise<UserPreferences> {
    return guard('Update preferences', async () => {
      const db = getDb();
      return db.transaction('rw', db.preferences, async () => {
        const current = (await db.preferences.get('user')) ?? defaultPreferences();
        const next = userPreferencesSchema.parse({ ...mutator(structuredClone(current)), id: 'user', updatedAt: nowIso() }) as UserPreferences;
        await db.preferences.put(next);
        return next;
      });
    });
  },
};
