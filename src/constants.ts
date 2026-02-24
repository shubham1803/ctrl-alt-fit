import type { MealTypeId } from './types';

export const MEAL_TYPES: Array<{ id: MealTypeId; label: string; icon: string }> = [
  { id: 'breakfast', label: 'Breakfast', icon: '🌅' },
  { id: 'lunch', label: 'Lunch', icon: '☀️' },
  { id: 'snack', label: 'Snack', icon: '🍎' },
  { id: 'dinner', label: 'Dinner', icon: '🌙' },
  { id: 'other', label: 'Other', icon: '🍽️' },
];

export const STORAGE_KEYS = {
  meals: 'caf_meals_v2',
  steps: 'caf_steps_v2',
};
