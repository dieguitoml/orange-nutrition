import type { Recipe } from '../../core/types/domain';
import { recipeSchema } from '../../core/validation/schemas';
import { DataError } from '../../core/utils/errors';
import { normalizeText } from '../../core/utils/text';
import { getDb, guard } from '../db';

const validate = (r: Recipe): Recipe => recipeSchema.parse(r) as Recipe;

export const recipeRepository = {
  async put(recipe: Recipe): Promise<Recipe> {
    return guard('Save recipe', async () => {
      const r = validate(recipe);
      await getDb().recipes.put(r);
      return r;
    });
  },
  async get(id: string): Promise<Recipe | null> {
    return guard('Get recipe', async () => (await getDb().recipes.get(id)) ?? null);
  },
  async getOrThrow(id: string): Promise<Recipe> {
    const r = await recipeRepository.get(id);
    if (!r) throw new DataError('NOT_FOUND', `Recipe ${id} not found`);
    return r;
  },
  async delete(id: string): Promise<void> {
    return guard('Delete recipe', () => getDb().recipes.delete(id));
  },
  async list(): Promise<Recipe[]> {
    return guard('List recipes', async () => (await getDb().recipes.toArray()).sort((a, b) => a.name.localeCompare(b.name)));
  },
  async search(query: string): Promise<Recipe[]> {
    const q = normalizeText(query);
    const all = await recipeRepository.list();
    return q ? all.filter((r) => normalizeText(`${r.name} ${r.tags.join(' ')}`).includes(q)) : all;
  },
};
