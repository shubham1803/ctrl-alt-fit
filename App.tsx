import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { Pedometer } from 'expo-sensors';

import { analyzeMealImage } from './src/api';
import { MEAL_TYPES } from './src/constants';
import { loadMeals, loadSteps, saveMeals, saveSteps, todayKey } from './src/storage';
import type { Meal, MealTypeId } from './src/types';

const showAlert = (title: string, message: string): void => {
  if (Platform.OS === 'web' && typeof globalThis !== 'undefined' && typeof (globalThis as { alert?: (value: string) => void }).alert === 'function') {
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

export default function App(): React.JSX.Element {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [meals, setMeals] = useState<Meal[]>([]);
  const [steps, setSteps] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealTypeId>('breakfast');
  const [isStepTrackingEnabled, setIsStepTrackingEnabled] = useState(false);
  const [isPedometerAvailable, setIsPedometerAvailable] = useState<boolean | null>(null);

  const pedometerSubRef = useRef<{ remove: () => void } | null>(null);
  const sessionBaseStepsRef = useRef(0);

  useEffect(() => {
    const init = async (): Promise<void> => {
      const [storedMeals, storedSteps] = await Promise.all([loadMeals(), loadSteps()]);
      setMeals(storedMeals);

      if (storedSteps.date === todayKey()) {
        setSteps(storedSteps.count);
      } else {
        setSteps(0);
        await saveSteps({ date: todayKey(), count: 0, trackingEnabled: false });
      }

      setIsStepTrackingEnabled(storedSteps.trackingEnabled && storedSteps.date === todayKey());
      const available = await Pedometer.isAvailableAsync();
      setIsPedometerAvailable(available);
    };

    init().catch((error) => {
      console.error('Failed to initialize app state', error);
    });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const dayNow = todayKey();
      saveSteps({ date: dayNow, count: steps, trackingEnabled: isStepTrackingEnabled }).catch(() => {});
    }, 60000);

    return () => clearInterval(interval);
  }, [steps, isStepTrackingEnabled]);

  useEffect(() => {
    return () => {
      if (pedometerSubRef.current) {
        pedometerSubRef.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    const syncTracking = async (): Promise<void> => {
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
        const next = Math.max(0, sessionBaseStepsRef.current + (Number(result.steps) || 0));
        setSteps(next);
        saveSteps({ date: todayKey(), count: next, trackingEnabled: true }).catch(() => {});
      });

      await saveSteps({ date: todayKey(), count: steps, trackingEnabled: true });
    };

    syncTracking().catch((error) => {
      console.error('Step tracking setup failed', error);
    });
  }, [isStepTrackingEnabled, isPedometerAvailable, steps]);

  useEffect(() => {
    saveMeals(meals).catch((error) => {
      console.error('Failed to persist meals', error);
    });
  }, [meals]);

  const todaysMeals = useMemo(() => {
    const now = new Date();
    return meals
      .filter((meal) => {
        const created = new Date(meal.createdAt);
        return (
          created.getFullYear() === now.getFullYear() &&
          created.getMonth() === now.getMonth() &&
          created.getDate() === now.getDate()
        );
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [meals]);

  const totals = useMemo(() => {
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

  const handleImagePick = async (mode: 'camera' | 'library'): Promise<void> => {
    try {
      const permission =
        mode === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        showAlert('Permission Required', `Please allow ${mode} access to continue.`);
        return;
      }

      const result =
        mode === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8,
              allowsEditing: false,
              base64: true,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8,
              allowsEditing: false,
              base64: true,
            });

      if (result.canceled || !result.assets[0]?.base64) {
        return;
      }

      setIsAnalyzing(true);
      const response = await analyzeMealImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
      const meal: Meal = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: response.name,
        items: response.items,
        itemDetails: response.itemDetails,
        calories: response.calories,
        protein: response.protein,
        carbs: response.carbs,
        fat: response.fat,
        fiber: response.fiber,
        mealType: selectedMealType,
        createdAt: new Date().toISOString(),
      };

      setMeals((prev) => [meal, ...prev]);
    } catch (error) {
      console.error('Meal analyze failed', error);
      showAlert('Analyze Failed', error instanceof Error ? error.message : 'Could not analyze this image.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const colors = isDark
    ? {
        bg: '#020617',
        card: '#0f172a',
        card2: '#111827',
        text: '#f8fafc',
        subText: '#94a3b8',
        accent: '#10b981',
        chip: '#1e293b',
      }
    : {
        bg: '#f8fafc',
        card: '#ffffff',
        card2: '#f1f5f9',
        text: '#0f172a',
        subText: '#475569',
        accent: '#059669',
        chip: '#e2e8f0',
      };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>CTRL-ALT-FIT</Text>
        <Text style={[styles.subtitle, { color: colors.subText }]}>Ctrl your senses. Alter your body. Become fit.</Text>
        <Text style={[styles.date, { color: colors.subText }]}>{formatDateLabel()}</Text>

        <View style={[styles.statsRow, { gap: 10 }]}> 
          <View style={[styles.statCard, { backgroundColor: colors.card }]}> 
            <Text style={[styles.statLabel, { color: colors.subText }]}>Calories</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{Math.round(totals.calories)}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}> 
            <Text style={[styles.statLabel, { color: colors.subText }]}>Steps</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{steps.toLocaleString()}</Text>
          </View>
        </View>

        <View style={[styles.statsRow, { gap: 10 }]}> 
          <View style={[styles.statCard, { backgroundColor: colors.card2 }]}> 
            <Text style={[styles.statLabel, { color: colors.subText }]}>Protein</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{Math.round(totals.protein)}g</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card2 }]}> 
            <Text style={[styles.statLabel, { color: colors.subText }]}>Carbs</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{Math.round(totals.carbs)}g</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card2 }]}> 
            <Text style={[styles.statLabel, { color: colors.subText }]}>Fat</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{Math.round(totals.fat)}g</Text>
          </View>
        </View>

        <View style={[styles.banner, { backgroundColor: colors.card, borderColor: colors.chip }]}> 
          <Text style={[styles.bannerText, { color: colors.text }]}>Calories Burned: {caloriesBurned} (estimated)</Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Log Meal As</Text>
        <View style={styles.mealTypesRow}>
          {MEAL_TYPES.map((type) => {
            const active = type.id === selectedMealType;
            return (
              <Pressable
                key={type.id}
                onPress={() => setSelectedMealType(type.id)}
                style={[
                  styles.mealTypeChip,
                  {
                    backgroundColor: active ? colors.accent : colors.chip,
                  },
                ]}
              >
                <Text style={{ color: active ? '#ffffff' : colors.text, fontWeight: '700' }}>
                  {type.icon} {type.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.actionsRow}>
          <Pressable style={[styles.actionBtn, { backgroundColor: '#065f46' }]} onPress={() => handleImagePick('camera')}>
            <Text style={styles.actionText}>Scan Meal</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, { backgroundColor: '#1d4ed8' }]} onPress={() => handleImagePick('library')}>
            <Text style={styles.actionText}>Upload Photo</Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.fullBtn, { backgroundColor: isStepTrackingEnabled ? '#b91c1c' : '#4f46e5' }]}
          onPress={() => setIsStepTrackingEnabled((prev) => !prev)}
        >
          <Text style={styles.actionText}>
            {isStepTrackingEnabled ? 'Disable Step Tracking' : 'Enable Step Tracking'}
          </Text>
        </Pressable>

        <Text style={[styles.helper, { color: colors.subText }]}>Pedometer: {isPedometerAvailable === null ? 'Checking...' : isPedometerAvailable ? 'Available' : 'Unavailable'}</Text>

        {isAnalyzing && (
          <View style={styles.analyzingRow}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[styles.helper, { color: colors.subText }]}>Analyzing meal...</Text>
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Today&apos;s Meals</Text>
        <FlatList
          data={todaysMeals}
          scrollEnabled={false}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={[styles.helper, { color: colors.subText }]}>No meals logged yet today.</Text>}
          renderItem={({ item }) => (
            <View style={[styles.mealCard, { backgroundColor: colors.card }]}> 
              <Text style={[styles.mealName, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.helper, { color: colors.subText }]}>
                {new Date(item.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {item.mealType}
              </Text>
              <Text style={[styles.helper, { color: colors.subText }]}>
                {Math.round(item.calories)} kcal · P {Math.round(item.protein)}g · C {Math.round(item.carbs)}g · F {Math.round(item.fat)}g
              </Text>
              {item.itemDetails.length > 0 && (
                <View style={styles.itemWrap}>
                  {item.itemDetails.map((entry, idx) => (
                    <View key={`${item.id}_${entry.name}_${idx}`} style={[styles.itemChip, { backgroundColor: colors.chip }]}> 
                      <Text style={{ color: colors.text, fontSize: 12 }}>
                        {entry.name} ({Math.round(entry.quantity_g)}g)
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 36,
    gap: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  date: {
    fontSize: 13,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4,
  },
  banner: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  bannerText: {
    fontSize: 14,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 8,
  },
  mealTypesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mealTypeChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  fullBtn: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  actionText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  helper: {
    fontSize: 12,
  },
  analyzingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mealCard: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  mealName: {
    fontSize: 16,
    fontWeight: '800',
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
});
