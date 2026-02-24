import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from './constants';
import type { Meal } from './types';

export type StepStore = {
  date: string;
  count: number;
  trackingEnabled: boolean;
};

export const todayKey = (): string => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

export const loadMeals = async (): Promise<Meal[]> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.meals);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveMeals = async (meals: Meal[]): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS.meals, JSON.stringify(meals));
};

export const loadSteps = async (): Promise<StepStore> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.steps);
  const base: StepStore = { date: todayKey(), count: 0, trackingEnabled: false };

  if (!raw) {
    return base;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StepStore>;
    return {
      date: typeof parsed.date === 'string' ? parsed.date : base.date,
      count: Number(parsed.count) > 0 ? Math.round(Number(parsed.count)) : 0,
      trackingEnabled: Boolean(parsed.trackingEnabled),
    };
  } catch {
    return base;
  }
};

export const saveSteps = async (steps: StepStore): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS.steps, JSON.stringify(steps));
};
