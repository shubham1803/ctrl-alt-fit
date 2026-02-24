import { Platform } from 'react-native';
import type { AnalyzeMealResponse } from './types';

const getApiBaseUrl = (): string => {
  const raw = (process.env.EXPO_PUBLIC_API_BASE_URL || '').trim();
  if (raw) {
    return raw.replace(/\/$/, '');
  }

  if (Platform.OS === 'web') {
    return '';
  }

  throw new Error('Set EXPO_PUBLIC_API_BASE_URL for native builds (e.g. https://your-app.vercel.app).');
};

export const analyzeMealImage = async (imageData: string): Promise<AnalyzeMealResponse> => {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/analyze-meal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ imageData }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Analyze failed (${response.status})`);
  }

  return {
    name: String(data?.name || 'Meal'),
    items: Array.isArray(data?.items) ? data.items : [],
    itemDetails: Array.isArray(data?.itemDetails) ? data.itemDetails : [],
    calories: Number(data?.calories) || 0,
    protein: Number(data?.protein) || 0,
    carbs: Number(data?.carbs) || 0,
    fat: Number(data?.fat) || 0,
    fiber: Number(data?.fiber) || 0,
  };
};
