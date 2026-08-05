import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { typography, spacing, radius } from '../../theme';
import { getClientRoutine } from '../../services/routineService';
import { MUSCLE_GROUPS } from '../../constants/exercises';

const OBJETIVO_LABELS = {
  perder_peso:    'Perder peso',
  ganar_musculo:  'Ganar músculo',
  mantenimiento:  'Mantenimiento',
  definicion:     'Definición',
  resistencia:    'Resistencia',
};

export default function ClienteDetailScreen({ route, navigation }) {
  const { cliente } = route.params;
  const { theme: { colors } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [routine, setRoutine]   = useState(undefined); // undefined = loading
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    getClientRoutine(cliente.uid)
      .then(setRoutine)
      .catch(() => setRoutine(null))
      .finally(() => setLoading(false));
  }, [cliente.uid]);

  const photoUri = cliente.photoBase64
    ? `data:image/jpeg;base64,${cliente.photoBase64}`
    : null;

  const initials = (
    (cliente.nombre?.[0] ?? '') + (cliente.apellido?.[0] ?? '')
  ).toUpperCase() || '?';

  const edad = calcAge(cliente.fechaNacimiento);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Perfil del cliente</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Profile card */}
        <View style={styles.profileCard}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <Text style={styles.nombre}>
            {cliente.nombre ?? ''} {cliente.apellido ?? ''}
          </Text>
          <Text style={styles.email}>{cliente.email ?? ''}</Text>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <Stat label="Edad"    value={edad ? `${edad} años` : '—'}            colors={colors} styles={styles} />
            <View style={styles.statDivider} />
            <Stat label="Peso"    value={cliente.peso   ? `${cliente.peso} kg`   : '—'} colors={colors} styles={styles} />
            <View style={styles.statDivider} />
            <Stat label="Altura"  value={cliente.altura ? `${cliente.altura} cm` : '—'} colors={colors} styles={styles} />
          </View>
        </View>

        {/* Info grid */}
        <View style={styles.infoGrid}>
          <InfoRow icon="trophy-outline"   label="Objetivo"
            value={OBJETIVO_LABELS[cliente.objetivo] ?? cliente.objetivo ?? '—'}
            colors={colors} styles={styles} />
          <InfoRow icon="star-outline"     label="Nivel"
            value={`Nivel ${cliente.nivelJuego ?? 1}`}
            colors={colors} styles={styles} />
          <InfoRow icon="calendar-outline" label="Ingresó"
            value={formatDate(cliente.fechaRegistro)}
            colors={colors} styles={styles} />
          {cliente.dni && (
            <InfoRow icon="card-outline" label="DNI" value={cliente.dni} colors={colors} styles={styles} />
          )}
        </View>

        {/* Current routine */}
        <Text style={styles.sectionTitle}>Rutina actual</Text>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
        ) : routine ? (
          <RoutineSummary routine={routine} colors={colors} styles={styles} />
        ) : (
          <View style={styles.emptyRoutine}>
            <Ionicons name="barbell-outline" size={32} color={colors.textTertiary} />
            <Text style={styles.emptyRoutineText}>Sin rutina asignada</Text>
          </View>
        )}

        {/* Progress button */}
        <TouchableOpacity
          style={styles.progressBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('ClientProgress', { cliente })}
        >
          <Ionicons name="trending-up-outline" size={20} color={colors.primary} style={{ marginRight: 8 }} />
          <Text style={styles.progressBtnText}>Ver progreso</Text>
        </TouchableOpacity>

        {/* Edit button */}
        <TouchableOpacity
          style={styles.editBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('RoutineEditor', {
            cliente,
            routine: routine ?? null,
          })}
        >
          <Ionicons name="create-outline" size={20} color={colors.textInverse} style={{ marginRight: 8 }} />
          <Text style={styles.editBtnText}>
            {routine ? 'Editar rutina' : 'Crear rutina'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, colors, styles }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value, colors, styles }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={colors.primary} style={styles.infoIcon} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function RoutineSummary({ routine, colors, styles }) {
  const groupCounts = {};
  (routine.dias ?? []).forEach(day => {
    (day.ejercicios ?? []).forEach(ex => {
      groupCounts[ex.grupoMuscular] = (groupCounts[ex.grupoMuscular] ?? 0) + 1;
    });
  });

  return (
    <View style={styles.routineCard}>
      <View style={styles.routineHeader}>
        <Text style={styles.routineName}>{routine.nombre ?? 'Rutina'}</Text>
        <Text style={styles.routineDays}>{routine.dias?.length ?? 0} días</Text>
      </View>

      {(routine.dias ?? []).map(day => (
        <View key={day.id} style={styles.dayRow}>
          <View style={styles.dayBadge}>
            <Text style={styles.dayBadgeText}>Día {day.numero}</Text>
          </View>
          <Text style={styles.dayExCount}>
            {day.ejercicios?.length ?? 0} ejercicio{day.ejercicios?.length !== 1 ? 's' : ''}
          </Text>
          <Text style={styles.dayMuscles} numberOfLines={1}>
            {[...new Set((day.ejercicios ?? []).map(e => {
              const g = MUSCLE_GROUPS.find(m => m.id === e.grupoMuscular);
              return g?.label ?? e.grupoMuscular;
            }))].join(', ')}
          </Text>
        </View>
      ))}
    </View>
  );
}

function calcAge(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  // Accepts "DD/MM/YYYY"
  const parts = fechaNacimiento.split('/');
  if (parts.length !== 3) return null;
  const dob = new Date(+parts[2], +parts[1] - 1, +parts[0]);
  const diff = Date.now() - dob.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function makeStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingVertical: 12,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: colors.surfaceContainerHigh,
      alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.black,
      color: colors.text, letterSpacing: -0.3,
    },

    scroll: { paddingHorizontal: spacing.lg, paddingBottom: 40 },

    // Profile card
    profileCard: {
      backgroundColor: colors.surfaceContainer,
      borderRadius: radius['2xl'],
      borderWidth: 1, borderColor: colors.borderLight,
      padding: spacing['2xl'],
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    avatar: {
      width: 90, height: 90, borderRadius: 45,
      borderWidth: 3, borderColor: colors.primary,
      marginBottom: spacing.md,
    },
    avatarFallback: {
      width: 90, height: 90, borderRadius: 45,
      backgroundColor: colors.primaryDim12,
      borderWidth: 3, borderColor: colors.primary,
      alignItems: 'center', justifyContent: 'center',
      marginBottom: spacing.md,
    },
    avatarText: {
      fontSize: 32, fontWeight: typography.weights.black, color: colors.primary,
    },
    nombre: {
      fontSize: typography.sizes.xl,
      fontWeight: typography.weights.black,
      color: colors.text, marginBottom: 4,
    },
    email: {
      fontSize: typography.sizes.sm, color: colors.textSecondary, marginBottom: spacing.lg,
    },

    statsRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.surfaceContainerHigh,
      borderRadius: radius.xl, paddingVertical: 14, paddingHorizontal: spacing.lg,
      width: '100%',
    },
    stat: { flex: 1, alignItems: 'center' },
    statValue: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.black,
      color: colors.text, marginBottom: 2,
    },
    statLabel: {
      fontSize: typography.sizes.xs, color: colors.textTertiary, fontWeight: '600',
      textTransform: 'uppercase', letterSpacing: 0.5,
    },
    statDivider: { width: 1, height: 32, backgroundColor: colors.border },

    // Info grid
    infoGrid: {
      backgroundColor: colors.surfaceContainer,
      borderRadius: radius['2xl'],
      borderWidth: 1, borderColor: colors.borderLight,
      marginBottom: spacing.lg,
      overflow: 'hidden',
    },
    infoRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: spacing.lg, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: colors.borderLight,
    },
    infoIcon: { marginRight: 12 },
    infoLabel: {
      fontSize: typography.sizes.sm, color: colors.textSecondary,
      fontWeight: typography.weights.semibold, width: 72,
    },
    infoValue: {
      flex: 1, fontSize: typography.sizes.base,
      color: colors.text, textAlign: 'right',
    },

    // Routine summary
    sectionTitle: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.bold,
      color: colors.textTertiary,
      letterSpacing: 1.5, textTransform: 'uppercase',
      marginBottom: spacing.md,
    },
    routineCard: {
      backgroundColor: colors.surfaceContainer,
      borderRadius: radius['2xl'],
      borderWidth: 1, borderColor: colors.borderLight,
      padding: spacing.lg,
      marginBottom: spacing.xl,
    },
    routineHeader: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', marginBottom: spacing.md,
    },
    routineName: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.black,
      color: colors.text,
    },
    routineDays: {
      fontSize: typography.sizes.xs,
      color: colors.primary,
      fontWeight: typography.weights.bold,
    },
    dayRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.borderLight,
    },
    dayBadge: {
      backgroundColor: colors.primaryDim12,
      paddingHorizontal: 8, paddingVertical: 3,
      borderRadius: radius.md,
    },
    dayBadgeText: {
      fontSize: 11, fontWeight: typography.weights.bold, color: colors.primary,
    },
    dayExCount: {
      fontSize: typography.sizes.sm, color: colors.textSecondary,
    },
    dayMuscles: {
      flex: 1, fontSize: typography.sizes.xs, color: colors.textTertiary,
      textAlign: 'right',
    },

    emptyRoutine: {
      alignItems: 'center', paddingVertical: 32, gap: 10,
      marginBottom: spacing.xl,
    },
    emptyRoutineText: {
      fontSize: typography.sizes.base, color: colors.textTertiary,
    },

    // Progress button
    progressBtn: {
      borderRadius: radius.full,
      borderWidth: 2, borderColor: colors.primary,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: 14,
      marginBottom: spacing.md,
    },
    progressBtnText: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.bold,
      color: colors.primary,
    },

    // Edit button
    editBtn: {
      backgroundColor: colors.primary,
      borderRadius: radius.full,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: 16,
      shadowColor: colors.primary, shadowOpacity: 0.4,
      shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
      elevation: 6,
    },
    editBtnText: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.bold,
      color: colors.textInverse,
    },
  });
}
