import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { buildTheme } from '../theme/themes';
import { typography, spacing, radius } from '../theme';

export default function AspectoScreen({ navigation }) {
  const { theme, themeMode, accentColorId, accentColors, setThemeMode, setAccentColor } = useTheme();
  const { colors, isDark } = theme;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Compute preview colors for both modes based on the current accent
  const accentObj = useMemo(
    () => accentColors.find((c) => c.id === accentColorId),
    [accentColors, accentColorId],
  );
  const darkColors  = useMemo(() => buildTheme('dark',  accentObj).colors, [accentObj]);
  const lightColors = useMemo(() => buildTheme('light', accentObj).colors, [accentObj]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Aspecto</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >

        {/* ── Tema ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TEMA</Text>
          <View style={styles.themeCard}>
            <View style={styles.themeRow}>
              {THEME_OPTIONS.map((opt) => (
                <ThemeOption
                  key={opt.id}
                  option={opt}
                  selected={themeMode === opt.id}
                  onSelect={() => setThemeMode(opt.id)}
                  colors={colors}
                  darkColors={darkColors}
                  lightColors={lightColors}
                />
              ))}
            </View>
          </View>
        </View>

        {/* ── Color de acento ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>COLOR DE ACENTO</Text>
          <View style={styles.accentCard}>
            <View style={styles.colorRow}>
              {accentColors.map((color) => (
                <AccentDot
                  key={color.id}
                  color={color}
                  selected={accentColorId === color.id}
                  onSelect={() => setAccentColor(color.id)}
                />
              ))}
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────
const THEME_OPTIONS = [
  { id: 'system', label: 'Sistema' },
  { id: 'dark',   label: 'Oscuro'  },
  { id: 'light',  label: 'Claro'   },
];

// ── ThemeOption ───────────────────────────────────────────────────────────────
function ThemeOption({ option, selected, onSelect, colors, darkColors, lightColors }) {
  return (
    <TouchableOpacity
      style={[
        themeOptionSt.card,
        {
          backgroundColor: colors.surfaceContainerHigh,
          borderColor: selected ? colors.primary : 'transparent',
        },
      ]}
      onPress={onSelect}
      activeOpacity={0.75}
    >
      <ThemePreview
        optionId={option.id}
        selected={selected}
        colors={colors}
        darkColors={darkColors}
        lightColors={lightColors}
      />
      <View style={themeOptionSt.labelRow}>
        <Text style={[themeOptionSt.label, { color: selected ? colors.primary : colors.textSecondary }]}>
          {option.label}
        </Text>
        {selected && (
          <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── ThemePreview ─────────────────────────────────────────────────────────────
// Preview cards use colors computed from the current accent for both modes,
// so they update when the accent color changes.
function ThemePreview({ optionId, selected, colors, darkColors, lightColors }) {
  if (optionId === 'system') {
    return (
      <View style={previewSt.wrap}>
        {/* Left half: dark mode bg */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: darkColors.surfaceLowest, right: '50%' }]} />
        {/* Right half: light mode bg */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: lightColors.background, left: '50%' }]} />
        {/* Accent bar on dark half */}
        <View style={[previewSt.bar, { backgroundColor: darkColors.primaryDim12, top: 14, width: 28, left: 10 }]} />
        {/* Neutral bar on light half */}
        <View style={[previewSt.bar, { backgroundColor: lightColors.border, top: 14, width: 28, right: 10 }]} />
        <Ionicons
          name="phone-portrait-outline"
          size={30}
          color={selected ? colors.primary : 'rgba(128,128,128,0.7)'}
          style={{ position: 'absolute', alignSelf: 'center' }}
        />
      </View>
    );
  }

  const dc = optionId === 'dark' ? darkColors : lightColors;
  const icon      = optionId === 'dark' ? 'moon' : 'sunny';
  const iconColor = selected ? colors.primary : dc.textTertiary;

  return (
    <View style={[previewSt.wrap, { backgroundColor: dc.background }]}>
      <View style={[previewSt.bar, { backgroundColor: dc.surfaceContainer, top: 14, width: '65%', left: 10 }]} />
      <View style={[previewSt.bar, { backgroundColor: dc.surfaceContainerHigh, top: 26, width: '45%', left: 10 }]} />
      <View style={[previewSt.dot, { backgroundColor: colors.primary, top: 12, right: 12 }]} />
      <Ionicons name={icon} size={16} color={iconColor} style={{ position: 'absolute', bottom: 10, right: 10 }} />
    </View>
  );
}

// ── AccentDot ─────────────────────────────────────────────────────────────────
function AccentDot({ color, selected, onSelect }) {
  return (
    <TouchableOpacity
      onPress={onSelect}
      activeOpacity={0.8}
      style={[
        accentSt.wrapper,
        { borderColor: selected ? color.hex : 'transparent' },
      ]}
    >
      <View style={[accentSt.dot, { backgroundColor: color.hex }]}>
        {selected && (
          <Ionicons name="checkmark" size={14} color={color.textOnAccent} />
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Static sub-component styles ───────────────────────────────────────────────
const themeOptionSt = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 2,
    padding: 4,
    paddingBottom: 10,
    gap: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});

const previewSt = StyleSheet.create({
  wrap: {
    height: 78,
    borderRadius: 10,
    overflow: 'hidden',
    width: '100%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    position: 'absolute',
    height: 6,
    borderRadius: 3,
  },
  dot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

const accentSt = StyleSheet.create({
  wrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  dot: {
    width: 33,
    height: 33,
    borderRadius: 16.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ── Dynamic styles ────────────────────────────────────────────────────────────
function makeStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceContainerHigh,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
    },
    scroll: {
      paddingHorizontal: 20,
      paddingBottom: 48,
    },
    section: { marginBottom: 28 },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textTertiary,
      letterSpacing: 1.5,
      marginBottom: 10,
      paddingLeft: 4,
    },
    themeCard: {
      backgroundColor: colors.surfaceContainer,
      borderRadius: 20,
      padding: 10,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    themeRow: {
      flexDirection: 'row',
      gap: 8,
    },
    accentCard: {
      backgroundColor: colors.surfaceContainer,
      borderRadius: 20,
      paddingVertical: 20,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    colorRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
    },
  });
}
