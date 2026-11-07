/** Fixtures shaped like real Open Food Facts v2 responses (values illustrative for tests only). */
export const OFF_FULL = {
  code: '3017620422003',
  status: 1,
  status_verbose: 'product found',
  product: {
    code: '3017620422003',
    product_name: 'Hazelnut spread',
    brands: 'BrandCo, Other',
    serving_size: '15 g',
    serving_quantity: 15,
    nutrition_data_per: '100g',
    allergens_tags: ['en:milk', 'en:nuts', 'en:soybeans'],
    traces_tags: [],
    categories_tags: ['en:spreads', 'en:sweet-spreads'],
    nutriments: {
      'energy-kcal_100g': 539,
      'energy-kj_100g': 2252,
      proteins_100g: 6.3,
      carbohydrates_100g: 57.5,
      sugars_100g: 56.3,
      fat_100g: 30.9,
      'saturated-fat_100g': 10.6,
      fiber_100g: 0,
      salt_100g: 0.107,
      sodium_100g: 0.0428,
      calcium_100g: 0.108,
      iron_100g: '0.0042',
      'vitamin-e_100g': 0.0062,
    },
  },
};

export const OFF_PARTIAL = {
  code: '5000000000001',
  status: 1,
  product: {
    product_name: '',
    product_name_en: 'Sparkling water lemon',
    nutriments: { 'energy-kj_100g': 8, salt_100g: 0.02, sugars_serving: 1, carbohydrates_100g: 0 },
    serving_quantity: '250',
  },
};

export const OFF_SERVING_ONLY = {
  status: 1,
  product: {
    product_name: 'Protein bar',
    serving_quantity: 60,
    nutrition_data_per: 'serving',
    allergens_tags: ['en:milk'],
    nutriments: { 'energy-kcal_serving': 210, proteins_serving: 20, carbohydrates_serving: 21, fat_serving: 7.2 },
  },
};

export const OFF_NOT_FOUND = { code: '0000000000000', status: 0, status_verbose: 'product not found' };
