import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from './constants';
import type { AppSettings, Group, Meal, UserProfile } from './types';

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

const parseArray = <T>(raw: string | null): T[] => {
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

export const loadMeals = async (): Promise<Meal[]> => {
  return parseArray<Meal>(await AsyncStorage.getItem(STORAGE_KEYS.meals));
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

export const loadProfile = async (): Promise<UserProfile | null> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.profile);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as UserProfile;
    if (!parsed?.id) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const saveProfile = async (profile: UserProfile): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
};

export const loadGroups = async (): Promise<Group[]> => {
  return parseArray<Group>(await AsyncStorage.getItem(STORAGE_KEYS.groups));
};

export const saveGroups = async (groups: Group[]): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS.groups, JSON.stringify(groups));
};

export const loadSettings = async (): Promise<AppSettings> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.settings);
  if (!raw) {
    return { themeMode: 'system' };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const themeMode = parsed.themeMode;
    return {
      themeMode: themeMode === 'dark' || themeMode === 'light' || themeMode === 'system' ? themeMode : 'system',
    };
  } catch {
    return { themeMode: 'system' };
  }
};

export const saveSettings = async (settings: AppSettings): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
};
