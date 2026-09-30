import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useColorScheme } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay,
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
  const rootStyle    = useAnimatedStyle(() => ({ flex: 1, opacity: opacity.value }));
  const respaldoRef = useRef(null);

  const [themeMode,     setThemeModeState]    = useState(DEFAULT_THEME_MODE);
  const [accentColorId, setAccentColorIdState] = useState(DEFAULT_ACCENT_ID);
  const [prefsLoaded,   setPrefsLoaded]        = useState(false);

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

  // Fundido corto: la pantalla baja, cambia el color y vuelve a subir.
  // El color nuevo se calcula MIENTRAS baja (no después), así cuando llega
  // abajo ya está listo y sube enseguida. Sube recién cuando la pantalla ya
  // se dibujó con los colores nuevos (así no se ve el salto).
  const inicioFundidoRef = useRef(0);
  const animate = useCallback((cambiar) => {
    inicioFundidoRef.current = Date.now();
    opacity.value = withTiming(0.4, { duration: 130 });
    // Un cuadro de espera para que el fundido arranque antes del trabajo pesado.
    requestAnimationFrame(() => cambiar());
    // Por si el cambio no altera el tema (tocar el mismo color): no quedarse opaco.
    clearTimeout(respaldoRef.current);
    respaldoRef.current = setTimeout(() => { opacity.value = withTiming(1, { duration: 220 }); }, 1500);
  }, [opacity]);

  const setThemeMode = useCallback((mode) => {
    animate(() => setThemeModeState(mode));
    // Guardar después del fundido: el guardado en Firebase hace que se
    // vuelvan a dibujar pantallas y frenaría el cambio de color.
    setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY_MODE, mode).catch(() => {});
      if (user?.uid) {
        updateDoc(doc(db, 'users', user.uid), { themeMode: mode }).catch(() => {});
      }
    }, 700);
  }, [animate, user?.uid]);

  const setAccentColor = useCallback((colorId) => {
    animate(() => setAccentColorIdState(colorId));
    setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY_ACCENT, colorId).catch(() => {});
      if (user?.uid) {
        updateDoc(doc(db, 'users', user.uid), { accentColorId: colorId }).catch(() => {});
      }
    }, 700);
  }, [animate, user?.uid]);

  const accentColor  = ACCENT_COLORS.find(c => c.id === accentColorId) ?? DEFAULT_ACCENT;
  const resolvedMode = themeMode === 'system' ? systemScheme : themeMode;
  const theme        = useMemo(
    () => buildTheme(resolvedMode, accentColor),
    [resolvedMode, accentColor]
  );

  useEffect(() => {
    if (!inicioFundidoRef.current) return;
    // Si el color quedó listo antes de que termine de bajar, esperar a que baje.
    const falta = Math.max(0, 130 - (Date.now() - inicioFundidoRef.current));
    inicioFundidoRef.current = 0;
    clearTimeout(respaldoRef.current);
    opacity.value = withDelay(falta, withTiming(1, { duration: 220 }));
  }, [theme]);

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