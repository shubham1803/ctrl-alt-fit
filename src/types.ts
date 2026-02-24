export type MealTypeId = 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'other';

export type Meal = {
  id: string;
  name: string;
  items: string[];
  itemDetails: Array<{ name: string; quantity_g: number }>;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  mealType: MealTypeId;
  createdAt: string;
};

export type AnalyzeMealResponse = {
  name: string;
  items: string[];
  itemDetails: Array<{ name: string; quantity_g: number }>;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};
