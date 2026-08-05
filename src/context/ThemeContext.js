import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, runOnJS,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import useAuth from '../hooks/useAuth';
import { ACCENT_COLORS, DEFAULT_ACCENT_ID, DEFAULT_THEME_MODE } from '../theme/palette';
import { buildTheme } from '../theme/themes';

const STORAGE_KEY_MODE   = '@theme_mode';
const STORAGE_KEY_ACCENT = '@accent_color_id';

const DEFAULT_ACCENT = ACCENT_COLORS.find(c => c.id === DEFAULT_ACCENT_ID);
const INITIAL_THEME  = buildTheme(DEFAULT_THEME_MODE, DEFAULT_ACCENT);

const ThemeContext = createContext({
  theme:          INITIAL_THEME,
  themeMode:      DEFAULT_THEME_MODE,
  accentColorId:  DEFAULT_ACCENT_ID,
  accentColors:   ACCENT_COLORS,
  setThemeMode:   () => {},
  setAccentColor: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }) {
  const { user }     = useAuth();
  const systemScheme = useColorScheme() ?? 'dark';
  const opacity      = useSharedValue(1);

  const [themeMode,     setThemeModeState]    = useState(DEFAULT_THEME_MODE);
  const [accentColorId, setAccentColorIdState] = useState(DEFAULT_ACCENT_ID);
  const [prefsLoaded,   setPrefsLoaded]        = useState(false);

  const rootStyle = useAnimatedStyle(() => ({ flex: 1, opacity: opacity.value }));

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY_MODE),
      AsyncStorage.getItem(STORAGE_KEY_ACCENT),
    ]).then(([savedMode, savedAccent]) => {
      if (savedMode && ['system', 'dark', 'light'].includes(savedMode)) {
        setThemeModeState(savedMode);
      }
      if (savedAccent && ACCENT_COLORS.some(c => c.id === savedAccent)) {
        setAccentColorIdState(savedAccent);
      }
    }).catch(() => {}).finally(() => setPrefsLoaded(true));
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (!snap.exists()) return;
      const { themeMode: m, accentColorId: a } = snap.data();
      if (m && ['system', 'dark', 'light'].includes(m)) setThemeModeState(m);
      if (a && ACCENT_COLORS.some(c => c.id === a))     setAccentColorIdState(a);
    }).catch(() => {});
  }, [user?.uid]);

  const animate = useCallback((callback) => {
    opacity.value = withTiming(0.4, { duration: 130 }, (finished) => {
      'worklet';
      if (finished) {
        runOnJS(callback)();
        opacity.value = withTiming(1, { duration: 220 });
      }
    });
  }, [opacity]);

  const setThemeMode = useCallback((mode) => {
    animate(() => setThemeModeState(mode));
    AsyncStorage.setItem(STORAGE_KEY_MODE, mode).catch(() => {});
    if (user?.uid) {
      updateDoc(doc(db, 'users', user.uid), { themeMode: mode }).catch(() => {});
    }
  }, [animate, user?.uid]);

  const setAccentColor = useCallback((colorId) => {
    animate(() => setAccentColorIdState(colorId));
    AsyncStorage.setItem(STORAGE_KEY_ACCENT, colorId).catch(() => {});
    if (user?.uid) {
      updateDoc(doc(db, 'users', user.uid), { accentColorId: colorId }).catch(() => {});
    }
  }, [animate, user?.uid]);

  const accentColor  = ACCENT_COLORS.find(c => c.id === accentColorId) ?? DEFAULT_ACCENT;
  const resolvedMode = themeMode === 'system' ? systemScheme : themeMode;
  const theme        = useMemo(
    () => buildTheme(resolvedMode, accentColor),
    [resolvedMode, accentColor]
  );

  const value = useMemo(() => ({
    theme,
    themeMode,
    accentColorId,
    accentColors: ACCENT_COLORS,
    setThemeMode,
    setAccentColor,
  }), [theme, themeMode, accentColorId, setThemeMode, setAccentColor]);

  if (!prefsLoaded) return null;

  return (
    <ThemeContext.Provider value={value}>
      <Animated.View style={rootStyle}>
        {children}
      </Animated.View>
    </ThemeContext.Provider>
  );
}