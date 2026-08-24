import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Switch, StyleSheet, Alert, Platform } from 'react-native';
import { TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { typography, spacing, radius } from '../theme';
import { nativeServiceAvailable, startNativeStepService, stopNativeStepService } from '../services/nativeStepService';

const STEP_SERVICE_DISABLED_KEY = 'STEP_SERVICE_DISABLED';

export default function SettingsScreen({ navigation }) {
  const { theme: { colors } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [serviceEnabled, setServiceEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STEP_SERVICE_DISABLED_KEY).then((val) => {
      setServiceEnabled(val !== 'true');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function handleToggle(newValue) {
    if (!newValue) {
      // Usuario quiere desactivar
      Alert.alert(
        'Desactivar servicio de pasos',
        'Sin el servicio activo, los pasos dejarán de contarse cuando la app esté cerrada o en segundo plano. ¿Estás seguro?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Desactivar',
            style: 'destructive',
            onPress: async () => {
              await AsyncStorage.setItem(STEP_SERVICE_DISABLED_KEY, 'true');
              setServiceEnabled(false);
              stopNativeStepService().catch(() => {});
            },
          },
        ]
      );
    } else {
      // Activar
      AsyncStorage.setItem(STEP_SERVICE_DISABLED_KEY, 'false').catch(() => {});
      setServiceEnabled(true);
      startNativeStepService().catch(() => {});
    }
  }

  const showStepToggle = Platform.OS === 'android' && nativeServiceAvailable;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configuración</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {showStepToggle && !loading && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PASOS</Text>
            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <Ionicons name="notifications-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>Notificación de pasos</Text>
                <Text style={styles.rowSub}>
                  {serviceEnabled
                    ? 'Activa · Cuenta pasos en segundo plano'
                    : 'Inactiva · Los pasos no se cuentan en segundo plano'}
                </Text>
              </View>
              <Switch
                value={serviceEnabled}
                onValueChange={handleToggle}
                trackColor={{ false: colors.border, true: colors.primary + '66' }}
                thumbColor={serviceEnabled ? colors.primary : colors.textTertiary}
              />
            </View>
            <Text style={styles.hint}>
              El servicio de pasos corre en segundo plano y muestra una notificación persistente en la barra de estado y pantalla de bloqueo. Desactivarlo elimina la notificación pero deja de contar pasos cuando la app está cerrada.
            </Text>
          </View>
        )}

        {!showStepToggle && !loading && (
          <View style={styles.emptyState}>
            <Ionicons name="settings-outline" size={44} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No hay configuraciones disponibles para este dispositivo.</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    container: {
      flex:            1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection:  'row',
      alignItems:     'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical:   spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    backBtn: {
      width: 40,
      height: 40,
      alignItems:     'center',
      justifyContent: 'center',
    },
    headerTitle: {
      ...typography.h3,
      color: colors.text,
    },
    content: {
      flex:    1,
      padding: spacing.lg,
    },
    section: {
      marginBottom: spacing.xl,
    },
    sectionLabel: {
      ...typography.caption,
      color:         colors.textTertiary,
      letterSpacing: 1,
      marginBottom:  spacing.sm,
    },
    row: {
      flexDirection:    'row',
      alignItems:       'center',
      backgroundColor:  colors.surface,
      borderRadius:     radius.lg,
      padding:          spacing.md,
      gap:              spacing.md,
    },
    rowIcon: {
      width:           36,
      height:          36,
      borderRadius:    18,
      backgroundColor: colors.primary + '22',
      alignItems:     'center',
      justifyContent: 'center',
    },
    rowBody: {
      flex: 1,
    },
    rowTitle: {
      ...typography.body,
      color:      colors.text,
      fontWeight: '600',
    },
    rowSub: {
      ...typography.caption,
      color:     colors.textSecondary,
      marginTop: 2,
    },
    hint: {
      ...typography.caption,
      color:      colors.textTertiary,
      marginTop:  spacing.sm,
      lineHeight: 18,
    },
    emptyState: {
      flex:           1,
      alignItems:     'center',
      justifyContent: 'center',
      gap:            spacing.md,
    },
    emptyText: {
      ...typography.body,
      color:     colors.textTertiary,
      textAlign: 'center',
    },
  });
}
