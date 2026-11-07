import type { Food, FoodSnapshot } from '../../core/types/domain';

export function snapshotOf(food: Food): FoodSnapshot {
  return structuredClone({
    name: food.name,
    ...(food.brand ? { brand: food.brand } : {}),
    sourceType: food.source.type,
    nutrientsPer100g: food.nutrientsPer100g,
    servings: food.servings,
    ...(food.densityGPerMl ? { densityGPerMl: food.densityGPerMl } : {}),
  });
}
