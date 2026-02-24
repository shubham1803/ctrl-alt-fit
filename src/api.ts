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

const requestJson = async <T>(path: string, init: RequestInit): Promise<T> => {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, init);
  const data = await response.json().catch(() => ({}));

  if (!response.ok && response.status !== 207) {
    throw new Error(data?.message || data?.error || `Request failed (${response.status})`);
  }

  return data as T;
};

export const analyzeMealImage = async (imageData: string): Promise<AnalyzeMealResponse> => {
  const data = await requestJson<Partial<AnalyzeMealResponse>>('/api/analyze-meal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ imageData }),
  });

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

export type InviteSendResult = {
  sent?: number;
  failed?: Array<{ email: string; error?: string }>;
};

export const sendGroupInvites = async (payload: {
  emails: string[];
  groupName: string;
  inviteUrl: string;
}): Promise<InviteSendResult> => {
  return requestJson<InviteSendResult>('/api/send-group-invite', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
};
