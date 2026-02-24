export type MealTypeId = 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'other';
export type AppTab = 'you' | 'groups';
export type GroupTab = 'leaderboard' | 'chat';
export type ThemeMode = 'system' | 'light' | 'dark';

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

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  picture?: string;
  age?: string;
  sex?: string;
};

export type GroupMember = {
  id: string;
  name: string;
  email?: string;
  picture?: string;
  steps: number;
};

export type GroupChatPost = {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  media?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'gif';
  sticker?: string;
  createdAt: string;
};

export type Group = {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  members: GroupMember[];
  posts: GroupChatPost[];
  createdAt: string;
};

export type AppSettings = {
  themeMode: ThemeMode;
};
