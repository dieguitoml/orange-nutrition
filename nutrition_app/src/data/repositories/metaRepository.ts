import { NUTRIENT_DEFINITIONS } from '../../core/constants/nutrients';
import type { NutrientDefinition } from '../../core/types/nutrients';
import { getDb, guard } from '../db';

export const metaRepository = {
  async get<T>(key: string): Promise<T | undefined> {
    return guard('Read metadata', async () => (await getDb().meta.get(key))?.value as T | undefined);
  },
  async set(key: string, value: unknown): Promise<void> {
    return guard('Write metadata', async () => {
      await getDb().meta.put({ key, value });
    });
  },
};

export const nutrientDefinitionRepository = {
  async list(): Promise<NutrientDefinition[]> {
    return guard('List nutrient definitions', async () => {
      const rows = await getDb().nutrientDefinitions.toArray();
      return rows.length ? rows.sort((a, b) => a.order - b.order) : [...NUTRIENT_DEFINITIONS];
    });
  },
  async sync(): Promise<void> {
    return guard('Sync nutrient definitions', async () => {
      await getDb().nutrientDefinitions.bulkPut([...NUTRIENT_DEFINITIONS]);
    });
  },
};
