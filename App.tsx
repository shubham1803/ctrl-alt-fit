import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { Pedometer } from 'expo-sensors';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

import { analyzeMealImage, sendGroupInvites } from './src/api';
import { MEAL_TYPES, STICKER_OPTIONS } from './src/constants';
import {
  clearProfile,
  loadGroups,
  loadMeals,
  loadProfile,
  loadSettings,
  loadSteps,
  saveGroups,
  saveMeals,
  saveProfile,
  saveSettings,
  saveSteps,
  todayKey,
} from './src/storage';
import type { AppTab, Group, GroupChatPost, GroupTab, Meal, MealTypeId, ThemeMode, UserProfile } from './src/types';

WebBrowser.maybeCompleteAuthSession();

const makeId = (prefix: string): string => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const showAlert = (title: string, message: string): void => {
  if (
    Platform.OS === 'web'
    && typeof globalThis !== 'undefined'
    && typeof (globalThis as { alert?: (value: string) => void }).alert === 'function'
  ) {
    (globalThis as { alert: (value: string) => void }).alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
};

const formatDateLabel = (): string => {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const getInviteBaseUrl = (): string => {
  const envBase = (process.env.EXPO_PUBLIC_API_BASE_URL || '').trim();
  if (envBase) {
    return envBase.replace(/\/$/, '');
  }

  if (
    Platform.OS === 'web'
    && typeof globalThis !== 'undefined'
    && typeof (globalThis as { location?: { origin?: string } }).location?.origin === 'string'
  ) {
    return (globalThis as { location: { origin: string } }).location.origin;
  }

  return 'https://ctrl-alt-fit.vercel.app';
};

export default function App(): React.JSX.Element {
  const osTheme = useColorScheme();

  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileDraft, setProfileDraft] = useState({ name: '', email: '', age: '', sex: '' });

  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const isDark = themeMode === 'system' ? osTheme === 'dark' : themeMode === 'dark';
  const [authError, setAuthError] = useState('');

  const googleWebClientId = (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '').trim();
  const googleIosClientId = (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '').trim();
  const googleAndroidClientId = (process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '').trim();
  const googleConfigured = Platform.OS === 'web'
    ? Boolean(googleWebClientId)
    : Boolean(googleIosClientId || googleAndroidClientId || googleWebClientId);

  const [googleRequest, googleResponse, promptGoogleSignIn] = Google.useAuthRequest({
    webClientId: googleWebClientId || undefined,
    iosClientId: googleIosClientId || undefined,
    androidClientId: googleAndroidClientId || undefined,
  });

  const [activeTab, setActiveTab] = useState<AppTab>('you');
  const [activeGroupTab, setActiveGroupTab] = useState<GroupTab>('leaderboard');

  const [meals, setMeals] = useState<Meal[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  const [steps, setSteps] = useState(0);
  const [isStepTrackingEnabled, setIsStepTrackingEnabled] = useState(false);
  const [isPedometerAvailable, setIsPedometerAvailable] = useState<boolean | null>(null);

  const [selectedMealType, setSelectedMealType] = useState<MealTypeId>('breakfast');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [inviteEmails, setInviteEmails] = useState('');
  const [isSendingInvites, setIsSendingInvites] = useState(false);

  const [groupMessage, setGroupMessage] = useState('');
  const [groupMedia, setGroupMedia] = useState<string | null>(null);
  const [groupMediaType, setGroupMediaType] = useState<'image' | 'video' | 'audio' | 'gif' | ''>('');

  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const pedometerSubRef = useRef<{ remove: () => void } | null>(null);
  const sessionBaseStepsRef = useRef(0);

  useEffect(() => {
    const initialize = async (): Promise<void> => {
      try {
        const [storedProfile, storedMeals, storedGroups, storedSteps, storedSettings] = await Promise.all([
          loadProfile(),
          loadMeals(),
          loadGroups(),
          loadSteps(),
          loadSettings(),
        ]);

        if (storedProfile) {
          setProfile(storedProfile);
          setProfileDraft({
            name: storedProfile.name || '',
            email: storedProfile.email || '',
            age: storedProfile.age || '',
            sex: storedProfile.sex || '',
          });
        }

        setMeals(storedMeals);
        setGroups(storedGroups);

        if (storedSteps.date === todayKey()) {
          setSteps(storedSteps.count);
          setIsStepTrackingEnabled(storedSteps.trackingEnabled);
        } else {
          setSteps(0);
          setIsStepTrackingEnabled(false);
          await saveSteps({ date: todayKey(), count: 0, trackingEnabled: false });
        }

        setThemeMode(storedSettings.themeMode || 'system');

        const available = await Pedometer.isAvailableAsync();
        setIsPedometerAvailable(available);
      } catch (error) {
        console.error('Initialization failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initialize().catch((error) => {
      console.error('Initialization exception:', error);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    const signInWithGoogle = async (): Promise<void> => {
      if (!googleResponse || googleResponse.type !== 'success') {
        return;
      }

      const accessToken = googleResponse.authentication?.accessToken;
      if (!accessToken) {
        setAuthError('Google sign-in failed to return access token.');
        return;
      }

      try {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Google profile fetch failed (${response.status})`);
        }

        const data = await response.json();
        const nextProfile: UserProfile = {
          id: String(data.sub || makeId('usr')),
          name: String(data.name || ''),
          email: String(data.email || ''),
          picture: String(data.picture || ''),
          age: '',
          sex: '',
        };

        setProfile(nextProfile);
        setProfileDraft({
          name: nextProfile.name,
          email: nextProfile.email,
          age: '',
          sex: '',
        });
        setAuthError('');
      } catch (error) {
        console.error('Google sign-in profile error:', error);
        setAuthError(error instanceof Error ? error.message : 'Could not load Google profile.');
      }
    };

    signInWithGoogle().catch((error) => {
      console.error('Google sign-in error:', error);
      setAuthError('Google sign-in failed.');
    });
  }, [googleResponse]);

  useEffect(() => {
    if (!profile) {
      return;
    }
    saveProfile(profile).catch((error) => console.error('Failed to save profile:', error));
  }, [profile]);

  useEffect(() => {
    saveMeals(meals).catch((error) => console.error('Failed to save meals:', error));
  }, [meals]);

  useEffect(() => {
    saveGroups(groups).catch((error) => console.error('Failed to save groups:', error));
  }, [groups]);

  useEffect(() => {
    saveSettings({ themeMode }).catch((error) => console.error('Failed to save settings:', error));
  }, [themeMode]);

  useEffect(() => {
    return () => {
      if (pedometerSubRef.current) {
        pedometerSubRef.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    const syncPedometer = async (): Promise<void> => {
      if (!isStepTrackingEnabled) {
        if (pedometerSubRef.current) {
          pedometerSubRef.current.remove();
          pedometerSubRef.current = null;
        }
        await saveSteps({ date: todayKey(), count: steps, trackingEnabled: false });
        return;
      }

      if (!isPedometerAvailable) {
        setIsStepTrackingEnabled(false);
        showAlert('Step Tracking Unavailable', 'Pedometer is not available on this device/browser.');
        return;
      }

      if (pedometerSubRef.current) {
        return;
      }

      sessionBaseStepsRef.current = steps;
      pedometerSubRef.current = Pedometer.watchStepCount((result) => {
        const nextSteps = Math.max(0, sessionBaseStepsRef.current + (Number(result.steps) || 0));
        setSteps(nextSteps);
      });

      await saveSteps({ date: todayKey(), count: steps, trackingEnabled: true });
    };

    syncPedometer().catch((error) => {
      console.error('Pedometer sync failed:', error);
    });
  }, [isStepTrackingEnabled, isPedometerAvailable, steps]);

  useEffect(() => {
    const timer = setInterval(() => {
      saveSteps({ date: todayKey(), count: steps, trackingEnabled: isStepTrackingEnabled }).catch(() => {});
    }, 60000);
    return () => clearInterval(timer);
  }, [steps, isStepTrackingEnabled]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    setGroups((prevGroups) => {
      let changed = false;
      const next = prevGroups.map((group) => {
        const memberExists = group.members.some((member) => member.id === profile.id);
        if (!memberExists) {
          return group;
        }

        const nextMembers = group.members.map((member) => {
          if (member.id !== profile.id) {
            return member;
          }

          const shouldUpdate = member.steps !== steps || member.name !== profile.name || (member.email || '') !== (profile.email || '');
          if (!shouldUpdate) {
            return member;
          }

          changed = true;
          return {
            ...member,
            name: profile.name,
            email: profile.email,
            picture: profile.picture,
            steps,
          };
        });

        return { ...group, members: nextMembers };
      });

      return changed ? next : prevGroups;
    });
  }, [steps, profile]);

  useEffect(() => {
    if (activeTab === 'groups') {
      setSelectedGroupId(null);
    }
  }, [activeTab]);

  const myGroups = useMemo(() => {
    if (!profile) {
      return [];
    }
    return groups.filter((group) => group.members.some((member) => member.id === profile.id));
  }, [groups, profile]);

  const selectedGroup = useMemo(() => {
    if (!selectedGroupId) {
      return null;
    }
    return myGroups.find((group) => group.id === selectedGroupId) || null;
  }, [myGroups, selectedGroupId]);

  const isGroupAdmin = Boolean(selectedGroup && profile && selectedGroup.ownerId === profile.id);

  const todaysMeals = useMemo(() => {
    const now = new Date();
    return meals
      .filter((meal) => {
        const created = new Date(meal.createdAt);
        return (
          created.getFullYear() === now.getFullYear()
          && created.getMonth() === now.getMonth()
          && created.getDate() === now.getDate()
        );
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [meals]);

  const todaysTotals = useMemo(() => {
    return todaysMeals.reduce(
      (acc, meal) => ({
        calories: acc.calories + meal.calories,
        protein: acc.protein + meal.protein,
        carbs: acc.carbs + meal.carbs,
        fat: acc.fat + meal.fat,
        fiber: acc.fiber + meal.fiber,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    );
  }, [todaysMeals]);

  const caloriesBurned = Math.round(steps * 0.04);

  const colors = isDark
    ? {
        bg: '#020617',
        surface: '#0f172a',
        elevated: '#111827',
        border: '#334155',
        text: '#f8fafc',
        muted: '#94a3b8',
        chip: '#1e293b',
        accent: '#10b981',
      }
    : {
        bg: '#f8fafc',
        surface: '#ffffff',
        elevated: '#f1f5f9',
        border: '#d1d5db',
        text: '#111827',
        muted: '#6b7280',
        chip: '#e5e7eb',
        accent: '#059669',
      };

  const createGroup = (): void => {
    if (!profile) {
      return;
    }

    const trimmed = newGroupName.trim();
    if (!trimmed) {
      showAlert('Group Name Required', 'Enter a group name first.');
      return;
    }

    const group: Group = {
      id: makeId('grp'),
      name: trimmed,
      inviteCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
      ownerId: profile.id,
      createdAt: new Date().toISOString(),
      members: [{
        id: profile.id,
        name: profile.name,
        email: profile.email,
        picture: profile.picture,
        steps,
      }],
      posts: [],
    };

    setGroups((prev) => [group, ...prev]);
    setNewGroupName('');
    setSelectedGroupId(group.id);
    setActiveGroupTab('leaderboard');
  };

  const getInviteUrl = (group: Group): string => {
    return `${getInviteBaseUrl()}?join=${group.inviteCode}`;
  };

  const shareInvite = async (group: Group): Promise<void> => {
    const url = getInviteUrl(group);
    const message = `Join ${group.name} on CTRL-ALT-FIT: ${url}`;

    try {
      const clipboardWrite = (globalThis as { navigator?: { clipboard?: { writeText?: (value: string) => Promise<void> } } })
        .navigator?.clipboard?.writeText;
      if (Platform.OS === 'web' && typeof clipboardWrite === 'function') {
        await clipboardWrite(message);
        showAlert('Copied', 'Invite link copied to clipboard.');
        return;
      }

      await Share.share({ message, title: `Join ${group.name}` });
    } catch (error) {
      console.error('Share failed:', error);
      showAlert('Share Failed', 'Could not share invite link.');
    }
  };

  const sendInvites = async (): Promise<void> => {
    if (!selectedGroup || !isGroupAdmin) {
      showAlert('Not Allowed', 'Only admin can send member invites.');
      return;
    }

    const emails = inviteEmails
      .split(/[\s,;]+/)
      .map((value) => value.trim())
      .filter(Boolean);

    if (!emails.length) {
      showAlert('Emails Required', 'Enter one or more email addresses.');
      return;
    }

    const invalid = emails.filter((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    if (invalid.length) {
      showAlert('Invalid Emails', `Please correct: ${invalid.slice(0, 3).join(', ')}`);
      return;
    }

    setIsSendingInvites(true);
    try {
      const result = await sendGroupInvites({
        emails,
        groupName: selectedGroup.name,
        inviteUrl: getInviteUrl(selectedGroup),
      });

      const sent = Number(result.sent) || 0;
      const failed = Array.isArray(result.failed) ? result.failed.length : 0;
      showAlert('Invite Result', `Sent: ${sent}\nFailed: ${failed}`);
      if (sent > 0) {
        setInviteEmails('');
      }
    } catch (error) {
      console.error('Invite sending failed:', error);
      showAlert('Invite Failed', error instanceof Error ? error.message : 'Could not send invites.');
    } finally {
      setIsSendingInvites(false);
    }
  };

  const pickMedia = async (mode: 'camera' | 'library'): Promise<void> => {
    try {
      const permission =
        mode === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        showAlert('Permission Required', `Please allow ${mode} access.`);
        return;
      }

      const result =
        mode === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.All,
              quality: 0.8,
              allowsEditing: false,
              base64: true,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.All,
              quality: 0.8,
              allowsEditing: false,
              base64: true,
            });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const asset = result.assets[0];
      const type = asset.type === 'video' ? 'video' : 'image';
      if (asset.base64) {
        const mime = type === 'video' ? 'video/mp4' : 'image/jpeg';
        setGroupMedia(`data:${mime};base64,${asset.base64}`);
      } else if (asset.uri) {
        setGroupMedia(asset.uri);
      }
      setGroupMediaType(type);
    } catch (error) {
      console.error('Media picker failed:', error);
      showAlert('Media Error', 'Could not load media.');
    }
  };

  const addGifByUrl = (): void => {
    if (Platform.OS !== 'web') {
      showAlert('GIF URL', 'Paste GIF URL in message for now on native.');
      return;
    }

    const promptFn = (globalThis as { prompt?: (value: string) => string | null }).prompt;
    const value = typeof promptFn === 'function' ? promptFn('Paste GIF URL') : null;
    const trimmed = (value || '').trim();
    if (!trimmed) {
      return;
    }

    if (!/^https?:\/\//i.test(trimmed)) {
      showAlert('Invalid URL', 'GIF URL must start with http or https.');
      return;
    }

    setGroupMedia(trimmed);
    setGroupMediaType('gif');
  };

  const postChatMessage = (): void => {
    if (!selectedGroup || !profile) {
      return;
    }

    const text = groupMessage.trim();
    if (!text && !groupMedia) {
      return;
    }

    const post: GroupChatPost = {
      id: makeId('post'),
      authorId: profile.id,
      authorName: profile.name,
      text,
      media: groupMedia || undefined,
      mediaType: groupMediaType || undefined,
      createdAt: new Date().toISOString(),
    };

    setGroups((prev) => prev.map((group) => {
      if (group.id !== selectedGroup.id) {
        return group;
      }
      return { ...group, posts: [post, ...group.posts] };
    }));

    setGroupMessage('');
    setGroupMedia(null);
    setGroupMediaType('');
  };

  const sendSticker = (sticker: string): void => {
    if (!selectedGroup || !profile) {
      return;
    }

    const post: GroupChatPost = {
      id: makeId('post'),
      authorId: profile.id,
      authorName: profile.name,
      text: '',
      sticker,
      createdAt: new Date().toISOString(),
    };

    setGroups((prev) => prev.map((group) => {
      if (group.id !== selectedGroup.id) {
        return group;
      }
      return { ...group, posts: [post, ...group.posts] };
    }));
  };

  const scanMeal = async (source: 'camera' | 'library'): Promise<void> => {
    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        showAlert('Permission Required', `Please allow ${source} access.`);
        return;
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.85,
              base64: true,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.85,
              base64: true,
            });

      if (result.canceled || !result.assets[0]?.base64) {
        return;
      }

      setIsAnalyzing(true);
      const analyzed = await analyzeMealImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
      const meal: Meal = {
        id: makeId('meal'),
        name: analyzed.name,
        items: analyzed.items,
        itemDetails: analyzed.itemDetails,
        calories: analyzed.calories,
        protein: analyzed.protein,
        carbs: analyzed.carbs,
        fat: analyzed.fat,
        fiber: analyzed.fiber,
        mealType: selectedMealType,
        createdAt: new Date().toISOString(),
      };
      setMeals((prev) => [meal, ...prev]);
    } catch (error) {
      console.error('Analyze meal error:', error);
      showAlert('Analyze Failed', error instanceof Error ? error.message : 'Could not analyze meal.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveProfileFromDraft = (): void => {
    if (!profile) {
      return;
    }

    const next: UserProfile = {
      ...profile,
      name: profileDraft.name.trim() || 'User',
      email: profileDraft.email.trim(),
      age: profileDraft.age.trim(),
      sex: profileDraft.sex.trim(),
    };

    setProfile(next);
    setIsProfileEditorOpen(false);
  };

  const firstName = (profile?.name || 'User').split(' ')[0];

  if (isLoading) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: isDark ? '#020617' : '#f8fafc' }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={{ marginTop: 12, color: isDark ? '#cbd5e1' : '#374151' }}>Loading CTRL-ALT-FIT...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: isDark ? '#020617' : '#f8fafc', paddingHorizontal: 20 }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Text style={{ color: isDark ? '#f8fafc' : '#111827', fontSize: 30, fontWeight: '900' }}>CTRL-ALT-FIT</Text>
        <Text style={{ color: isDark ? '#94a3b8' : '#6b7280', marginTop: 6, textAlign: 'center' }}>
          Sign in with Google to continue.
        </Text>
        <Pressable
          style={[
            styles.fullBtn,
            {
              marginTop: 16,
              minWidth: 230,
              backgroundColor: (!googleConfigured || !googleRequest) ? '#6b7280' : '#2563eb',
            },
          ]}
          disabled={!googleConfigured || !googleRequest}
          onPress={() => promptGoogleSignIn()}
        >
          <Text style={styles.primaryBtnText}>Sign In With Google</Text>
        </Pressable>
        {!googleConfigured ? (
          <Text style={{ color: '#f59e0b', marginTop: 10, textAlign: 'center', fontSize: 12 }}>
            Configure EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID / EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID / EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
          </Text>
        ) : null}
        {authError ? (
          <Text style={{ color: '#ef4444', marginTop: 10, textAlign: 'center', fontSize: 12 }}>{authError}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}> 
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}> 
        <View style={{ flex: 1 }}>
          <Text style={[styles.appTitle, { color: colors.text }]}>CTRL-ALT-FIT</Text>
          <Text style={[styles.tagline, { color: colors.muted }]}>Ctrl your senses. Alter your body. Become fit.</Text>
          <Text style={[styles.welcome, { color: colors.text }]}>Welcome, {firstName}</Text>
          <Text style={[styles.dateLabel, { color: colors.muted }]}>{formatDateLabel()}</Text>
        </View>

        <View style={{ alignItems: 'flex-end', gap: 8 }}>
          <Pressable
            style={[styles.avatarCircle, { borderColor: colors.border, backgroundColor: colors.elevated }]}
            onPress={() => {
              setIsSettingsOpen(false);
              setProfileDraft({
                name: profile.name || '',
                email: profile.email || '',
                age: profile.age || '',
                sex: profile.sex || '',
              });
              setIsProfileEditorOpen((prev) => !prev);
            }}
          >
            {profile.picture ? (
              <Image source={{ uri: profile.picture }} style={styles.avatarImage} />
            ) : (
              <Text style={{ color: colors.text, fontWeight: '800' }}>{firstName.slice(0, 1).toUpperCase()}</Text>
            )}
          </Pressable>

          <Pressable
            style={[styles.menuBtn, { borderColor: colors.border, backgroundColor: colors.elevated }]}
            onPress={() => {
              setIsProfileEditorOpen(false);
              setIsSettingsOpen((prev) => !prev);
            }}
          >
            <Text style={{ color: colors.text }}>⚙️</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.tabRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}> 
        <Pressable
          style={[styles.tabBtn, { backgroundColor: activeTab === 'you' ? colors.accent : colors.chip }]}
          onPress={() => setActiveTab('you')}
        >
          <Text style={{ color: activeTab === 'you' ? '#fff' : colors.text, fontWeight: '700' }}>You</Text>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, { backgroundColor: activeTab === 'groups' ? colors.accent : colors.chip }]}
          onPress={() => setActiveTab('groups')}
        >
          <Text style={{ color: activeTab === 'groups' ? '#fff' : colors.text, fontWeight: '700' }}>Groups</Text>
        </Pressable>
      </View>

      {isProfileEditorOpen && (
        <View style={[styles.overlayCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.overlayTitle, { color: colors.text }]}>Edit Profile</Text>
          <TextInput
            value={profileDraft.name}
            onChangeText={(value) => setProfileDraft((prev) => ({ ...prev, name: value }))}
            placeholder="Name"
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.elevated }]}
          />
          <TextInput
            value={profileDraft.email}
            onChangeText={(value) => setProfileDraft((prev) => ({ ...prev, email: value }))}
            placeholder="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.elevated }]}
          />
          <View style={styles.rowGap}>
            <TextInput
              value={profileDraft.age}
              onChangeText={(value) => setProfileDraft((prev) => ({ ...prev, age: value }))}
              placeholder="Age"
              keyboardType="number-pad"
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.flex1, { color: colors.text, borderColor: colors.border, backgroundColor: colors.elevated }]}
            />
            <TextInput
              value={profileDraft.sex}
              onChangeText={(value) => setProfileDraft((prev) => ({ ...prev, sex: value }))}
              placeholder="Sex"
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.flex1, { color: colors.text, borderColor: colors.border, backgroundColor: colors.elevated }]}
            />
          </View>
          <View style={styles.rowGap}>
            <Pressable style={[styles.smallBtn, { backgroundColor: colors.chip }]} onPress={() => setIsProfileEditorOpen(false)}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.smallBtn, { backgroundColor: colors.accent }]} onPress={saveProfileFromDraft}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>Save</Text>
            </Pressable>
          </View>
        </View>
      )}

      {isSettingsOpen && (
        <View style={[styles.overlayCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.overlayTitle, { color: colors.text }]}>Settings</Text>
          <Text style={{ color: colors.muted, marginBottom: 10 }}>Theme</Text>
          <View style={styles.rowGap}>
            {(['system', 'light', 'dark'] as ThemeMode[]).map((mode) => {
              const active = themeMode === mode;
              return (
                <Pressable
                  key={mode}
                  onPress={() => setThemeMode(mode)}
                  style={[styles.smallBtn, { backgroundColor: active ? colors.accent : colors.chip }]}
                >
                  <Text style={{ color: active ? '#fff' : colors.text, fontWeight: '700' }}>{mode}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            style={[styles.fullBtn, { marginTop: 10, backgroundColor: '#b91c1c' }]}
            onPress={async () => {
              await clearProfile().catch(() => {});
              setProfile(null);
              setIsSettingsOpen(false);
              setIsProfileEditorOpen(false);
            }}
          >
            <Text style={styles.primaryBtnText}>Sign Out</Text>
          </Pressable>
        </View>
      )}

      {activeTab === 'you' ? (
        <ScrollView contentContainerStyle={styles.content}> 
          <View style={styles.rowGap}>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <Text style={[styles.statLabel, { color: colors.muted }]}>Today&apos;s Calories</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{Math.round(todaysTotals.calories)}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <Text style={[styles.statLabel, { color: colors.muted }]}>Steps</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{steps.toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.rowGap}>
            <View style={[styles.statCardSmall, { backgroundColor: colors.elevated, borderColor: colors.border }]}> 
              <Text style={[styles.statLabel, { color: colors.muted }]}>Protein</Text>
              <Text style={[styles.statValueSmall, { color: colors.text }]}>{Math.round(todaysTotals.protein)}g</Text>
            </View>
            <View style={[styles.statCardSmall, { backgroundColor: colors.elevated, borderColor: colors.border }]}> 
              <Text style={[styles.statLabel, { color: colors.muted }]}>Carbs</Text>
              <Text style={[styles.statValueSmall, { color: colors.text }]}>{Math.round(todaysTotals.carbs)}g</Text>
            </View>
            <View style={[styles.statCardSmall, { backgroundColor: colors.elevated, borderColor: colors.border }]}> 
              <Text style={[styles.statLabel, { color: colors.muted }]}>Fat</Text>
              <Text style={[styles.statValueSmall, { color: colors.text }]}>{Math.round(todaysTotals.fat)}g</Text>
            </View>
          </View>

          <View style={[styles.banner, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <Text style={{ color: colors.text, fontWeight: '700' }}>Calories Burned: {caloriesBurned}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Estimated from steps</Text>
          </View>

          <View style={[styles.banner, { backgroundColor: isDark ? '#0b5a45' : '#dcfce7', borderColor: isDark ? '#10b981' : '#86efac' }]}> 
            <Text style={{ color: isDark ? '#f8fafc' : '#065f46', fontWeight: '700' }}>AI Model: Gemini 2.5 Flash-Lite (Free Tier)</Text>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Log This As</Text>
          <View style={styles.chipWrap}>
            {MEAL_TYPES.map((mealType) => {
              const active = selectedMealType === mealType.id;
              const count = todaysMeals.filter((meal) => meal.mealType === mealType.id).length;
              return (
                <Pressable
                  key={mealType.id}
                  onPress={() => setSelectedMealType(mealType.id)}
                  style={[styles.chip, { backgroundColor: active ? colors.accent : colors.chip }]}
                >
                  <Text style={{ color: active ? '#fff' : colors.text, fontWeight: '700' }}>{mealType.icon} {mealType.label}</Text>
                  <Text style={{ color: active ? '#dcfce7' : colors.muted, fontSize: 11 }}>{count} today</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.rowGap}>
            <Pressable style={[styles.primaryBtn, { backgroundColor: '#166534' }]} onPress={() => scanMeal('camera')}>
              <Text style={styles.primaryBtnText}>Scan Meal</Text>
            </Pressable>
            <Pressable style={[styles.primaryBtn, { backgroundColor: '#1d4ed8' }]} onPress={() => scanMeal('library')}>
              <Text style={styles.primaryBtnText}>Upload Photo</Text>
            </Pressable>
          </View>

          <Pressable
            style={[styles.fullBtn, { backgroundColor: isStepTrackingEnabled ? '#b91c1c' : '#4f46e5' }]}
            onPress={() => setIsStepTrackingEnabled((prev) => !prev)}
          >
            <Text style={styles.primaryBtnText}>{isStepTrackingEnabled ? 'Disable Step Counter' : 'Enable Step Counter'}</Text>
          </Pressable>

          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Pedometer: {isPedometerAvailable === null ? 'Checking...' : isPedometerAvailable ? 'Available' : 'Unavailable'}
          </Text>

          {isAnalyzing && (
            <View style={styles.rowGapCenter}>
              <ActivityIndicator color={colors.accent} />
              <Text style={{ color: colors.muted }}>Analyzing meal...</Text>
            </View>
          )}

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Today&apos;s Meals</Text>
          <FlatList
            data={todaysMeals}
            scrollEnabled={false}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={<Text style={{ color: colors.muted }}>No meals added yet today.</Text>}
            renderItem={({ item }) => (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
                <Text style={[styles.cardTitle, { color: colors.text }]}>{item.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {new Date(item.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} • {item.mealType}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {Math.round(item.calories)} kcal • P {Math.round(item.protein)}g • C {Math.round(item.carbs)}g • F {Math.round(item.fat)}g • Fiber {Math.round(item.fiber)}g
                </Text>
                <View style={styles.itemWrap}>
                  {item.itemDetails.map((entry, index) => (
                    <View key={`${item.id}_${entry.name}_${index}`} style={[styles.itemChip, { backgroundColor: colors.chip }]}> 
                      <Text style={{ color: colors.text, fontSize: 12 }}>{entry.name} ({Math.round(entry.quantity_g)}g)</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content}> 
          {!selectedGroup ? (
            <>
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
                <Text style={[styles.cardTitle, { color: colors.text }]}>Create Group</Text>
                <TextInput
                  value={newGroupName}
                  onChangeText={setNewGroupName}
                  placeholder="Group name"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.elevated }]}
                />
                <Pressable style={[styles.fullBtn, { backgroundColor: colors.accent }]} onPress={createGroup}>
                  <Text style={styles.primaryBtnText}>Create Group</Text>
                </Pressable>
              </View>

              <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Groups</Text>
              {myGroups.length === 0 ? (
                <Text style={{ color: colors.muted }}>No groups yet.</Text>
              ) : (
                myGroups.map((group) => (
                  <Pressable
                    key={group.id}
                    style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => {
                      setSelectedGroupId(group.id);
                      setActiveGroupTab('leaderboard');
                    }}
                  >
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{group.name}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{group.members.length} members</Text>
                  </Pressable>
                ))
              )}
            </>
          ) : (
            <>
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
                <View style={styles.rowSpaceBetween}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{selectedGroup.name}</Text>
                  <Pressable style={[styles.smallBtn, { backgroundColor: colors.chip }]} onPress={() => setSelectedGroupId(null)}>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>Back</Text>
                  </Pressable>
                </View>

                <View style={styles.rowGap}>
                  <Pressable
                    style={[styles.tabBtn, { backgroundColor: activeGroupTab === 'leaderboard' ? colors.accent : colors.chip }]}
                    onPress={() => setActiveGroupTab('leaderboard')}
                  >
                    <Text style={{ color: activeGroupTab === 'leaderboard' ? '#fff' : colors.text, fontWeight: '700' }}>Leaderboard</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.tabBtn, { backgroundColor: activeGroupTab === 'chat' ? colors.accent : colors.chip }]}
                    onPress={() => setActiveGroupTab('chat')}
                  >
                    <Text style={{ color: activeGroupTab === 'chat' ? '#fff' : colors.text, fontWeight: '700' }}>Chat</Text>
                  </Pressable>
                </View>

                {isGroupAdmin && (
                  <>
                    <Text style={{ color: colors.muted, marginTop: 8, marginBottom: 6 }}>Add members by email</Text>
                    <TextInput
                      value={inviteEmails}
                      onChangeText={setInviteEmails}
                      multiline
                      numberOfLines={3}
                      placeholder="member1@email.com, member2@email.com"
                      placeholderTextColor={colors.muted}
                      style={[styles.input, styles.textarea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.elevated }]}
                    />
                    <View style={styles.rowGap}>
                      <Pressable
                        style={[styles.smallBtn, { backgroundColor: isSendingInvites ? '#6b7280' : '#16a34a' }]}
                        onPress={sendInvites}
                        disabled={isSendingInvites}
                      >
                        <Text style={{ color: '#fff', fontWeight: '800' }}>{isSendingInvites ? 'Sending...' : 'Send Invites'}</Text>
                      </Pressable>
                      <Pressable style={[styles.smallBtn, { backgroundColor: '#2563eb' }]} onPress={() => shareInvite(selectedGroup)}>
                        <Text style={{ color: '#fff', fontWeight: '800' }}>Share Invite</Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>

              {activeGroupTab === 'leaderboard' ? (
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Leaderboard</Text>
                  {[...selectedGroup.members]
                    .sort((a, b) => b.steps - a.steps)
                    .map((member, index) => (
                      <View key={member.id} style={[styles.rowSpaceBetween, styles.memberRow, { borderBottomColor: colors.border }]}> 
                        <Text style={{ color: colors.text }}>{index + 1}. {member.name}</Text>
                        <Text style={{ color: colors.muted }}>{member.steps.toLocaleString()} steps</Text>
                      </View>
                    ))}
                </View>
              ) : (
                <View style={[styles.card, { backgroundColor: '#0b141a', borderColor: '#1f2c34' }]}> 
                  <Text style={[styles.cardTitle, { color: '#f8fafc' }]}>Group Chat</Text>

                  <View style={{ gap: 8 }}>
                    {selectedGroup.posts.length === 0 ? (
                      <Text style={{ color: '#94a3b8' }}>No messages yet.</Text>
                    ) : (
                      selectedGroup.posts.slice().reverse().map((post) => {
                        const mine = post.authorId === profile.id;
                        return (
                          <View key={post.id} style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                            <View style={[styles.chatBubble, { backgroundColor: mine ? '#005c4b' : '#202c33' }]}> 
                              {!mine && <Text style={{ color: '#8ec8ff', fontSize: 11, marginBottom: 4 }}>{post.authorName}</Text>}
                              {post.sticker ? <Text style={{ fontSize: 34 }}>{post.sticker}</Text> : null}
                              {post.text ? <Text style={{ color: '#fff' }}>{post.text}</Text> : null}
                              {post.media ? (
                                post.mediaType === 'video' ? (
                                  <Text style={{ color: '#cbd5e1', marginTop: 6 }}>[Video attached]</Text>
                                ) : post.mediaType === 'audio' ? (
                                  <Text style={{ color: '#cbd5e1', marginTop: 6 }}>[Voice note attached]</Text>
                                ) : (
                                  <Image source={{ uri: post.media }} style={styles.chatImage} resizeMode="cover" />
                                )
                              ) : null}
                              <Text style={{ color: '#cbd5e1', fontSize: 10, marginTop: 4 }}>
                                {new Date(post.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                              </Text>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>

                  <View style={[styles.chatComposer, { borderTopColor: '#1f2c34' }]}> 
                    <View style={styles.rowGap}>
                      <Pressable style={[styles.iconBtn, { backgroundColor: '#202c33' }]} onPress={() => pickMedia('library')}>
                        <Text style={{ color: '#e2e8f0' }}>＋</Text>
                      </Pressable>
                      <Pressable style={[styles.iconBtn, { backgroundColor: '#202c33' }]} onPress={() => pickMedia('camera')}>
                        <Text style={{ color: '#e2e8f0' }}>📷</Text>
                      </Pressable>
                      <Pressable style={[styles.iconBtn, { backgroundColor: '#202c33' }]} onPress={addGifByUrl}>
                        <Text style={{ color: '#e2e8f0' }}>GIF</Text>
                      </Pressable>
                    </View>

                    <TextInput
                      value={groupMessage}
                      onChangeText={setGroupMessage}
                      placeholder="Type a message"
                      placeholderTextColor="#94a3b8"
                      multiline
                      style={[styles.input, styles.chatInput, { color: '#f8fafc', borderColor: '#2a3942', backgroundColor: '#111b21' }]}
                    />

                    <View style={styles.rowGapWrap}>
                      {STICKER_OPTIONS.map((sticker) => (
                        <Pressable key={sticker} onPress={() => sendSticker(sticker)} style={[styles.stickerBtn, { backgroundColor: '#202c33' }]}> 
                          <Text>{sticker}</Text>
                        </Pressable>
                      ))}
                    </View>

                    {groupMedia ? (
                      <View style={[styles.card, { backgroundColor: '#111b21', borderColor: '#2a3942', marginTop: 8 }]}> 
                        <Text style={{ color: '#cbd5e1', marginBottom: 6 }}>Media ready to send ({groupMediaType || 'file'})</Text>
                        {groupMediaType === 'image' || groupMediaType === 'gif' ? (
                          <Image source={{ uri: groupMedia }} style={styles.previewImage} resizeMode="cover" />
                        ) : (
                          <Text style={{ color: '#94a3b8' }}>{groupMediaType === 'video' ? '[Video selected]' : '[Voice note selected]'}</Text>
                        )}
                        <Pressable style={[styles.smallBtn, { backgroundColor: '#334155', marginTop: 8 }]} onPress={() => { setGroupMedia(null); setGroupMediaType(''); }}>
                          <Text style={{ color: '#fff', fontWeight: '700' }}>Remove</Text>
                        </Pressable>
                      </View>
                    ) : null}

                    <Pressable style={[styles.fullBtn, { backgroundColor: '#10b981', marginTop: 8 }]} onPress={postChatMessage}>
                      <Text style={styles.primaryBtnText}>Send</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: Platform.OS === 'ios' ? 54 : 24,
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
  },
  appTitle: { fontSize: 30, fontWeight: '900' },
  tagline: { fontSize: 12, fontWeight: '600' },
  welcome: { marginTop: 4, fontSize: 14, fontWeight: '700' },
  dateLabel: { fontSize: 12 },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  menuBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 8,
    borderBottomWidth: 1,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    minHeight: 40,
  },
  content: {
    padding: 14,
    paddingBottom: 28,
    gap: 10,
  },
  rowGap: {
    flexDirection: 'row',
    gap: 8,
  },
  rowGapWrap: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  rowGapCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowSpaceBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  statCardSmall: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  statValue: {
    marginTop: 4,
    fontSize: 28,
    fontWeight: '900',
  },
  statValueSmall: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: '800',
  },
  banner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 8,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: '31%',
  },
  primaryBtn: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  fullBtn: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 12,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '800',
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  itemWrap: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  itemChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  memberRow: {
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textarea: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  flex1: { flex: 1 },
  overlayCard: {
    marginHorizontal: 14,
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  overlayTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  smallBtn: {
    borderRadius: 10,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    flex: 1,
  },
  chatBubble: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: '92%',
  },
  chatImage: {
    marginTop: 6,
    width: 180,
    height: 140,
    borderRadius: 10,
    backgroundColor: '#0f172a',
  },
  chatComposer: {
    marginTop: 10,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  iconBtn: {
    borderRadius: 10,
    minHeight: 38,
    minWidth: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  chatInput: {
    minHeight: 52,
    marginTop: 8,
    textAlignVertical: 'top',
  },
  stickerBtn: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  previewImage: {
    width: '100%',
    height: 170,
    borderRadius: 8,
    backgroundColor: '#0f172a',
  },
});
