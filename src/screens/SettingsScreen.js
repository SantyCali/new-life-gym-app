import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Switch, StyleSheet, Alert, Platform, Linking, Modal, TextInput, ActivityIndicator } from 'react-native';
import { TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { typography, spacing, radius } from '../theme';
import useAuth from '../hooks/useAuth';
import {
  nativeServiceAvailable,
  getNotificationSilent,
  setNotificationSilent,
} from '../services/nativeStepService';

export default function SettingsScreen({ navigation }) {
  const { theme: { colors } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { deleteAccount } = useAuth();

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword]         = useState('');
  const [deleting, setDeleting]                     = useState(false);

  function confirmDeleteAccount() {
    Alert.alert(
      'Eliminar cuenta',
      'Esta acción es permanente: se borra tu cuenta y todos tus datos (perfil, historial de pasos, historial de gym). No se puede deshacer.\n\n¿Querés continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Continuar', style: 'destructive', onPress: () => setDeleteModalVisible(true) },
      ]
    );
  }

  async function handleDeleteAccount() {
    if (!deletePassword) return;
    setDeleting(true);
    try {
      await deleteAccount(deletePassword);
      // Si esto resuelve, AuthContext ya detectó la sesión cerrada y el resto
      // de la app navega sola a la pantalla de login (mismo mecanismo que
      // signOut) — no hace falta navegar manualmente desde acá.
    } catch (e) {
      Alert.alert('No se pudo eliminar la cuenta', e?.message ?? 'Ocurrió un error inesperado.');
    } finally {
      setDeleting(false);
      setDeletePassword('');
      setDeleteModalVisible(false);
    }
  }

  // notificationVisible = true → notificación normal visible
  // notificationVisible = false → canal silencioso (sin ícono en barra)
  // En ambos casos el servicio corre y los pasos se cuentan
  const [notificationVisible, setNotificationVisible] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!nativeServiceAvailable) { setLoading(false); return; }
    getNotificationSilent().then((isSilent) => {
      setNotificationVisible(!isSilent);
      setLoading(false);
    });
  }, []);

  async function applyToggle(newValue) {
    try {
      await setNotificationSilent(!newValue);
      setNotificationVisible(newValue);
    } catch (e) {
      // La llamada nativa falló de verdad — mostrarlo en vez de fingir que
      // el cambio se aplicó (antes este error se tragaba en silencio y el
      // switch quedaba desincronizado de lo que mostraba la notificación real).
      Alert.alert(
        'No se pudo aplicar el cambio',
        e?.message ?? 'Ocurrió un error al actualizar la notificación.',
      );
    }
  }

  function handleToggle(newValue) {
    if (!newValue) {
      // Quiere ocultar la notificación
      Alert.alert(
        'Ocultar notificación de pasos',
        'Los pasos seguirán contándose en segundo plano, pero la notificación dejará de aparecer en la barra de estado y pantalla de bloqueo.\n\n¿Estás seguro?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Ocultar',
            style: 'destructive',
            onPress: () => applyToggle(false),
          },
        ]
      );
    } else {
      applyToggle(true);
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
                <Text style={styles.rowTitle}>Notificación en pantalla de bloqueo</Text>
                <Text style={styles.rowSub}>
                  {notificationVisible
                    ? 'Visible en barra de estado'
                    : 'Oculta · Los pasos siguen contando'}
                </Text>
              </View>
              <Switch
                value={notificationVisible}
                onValueChange={handleToggle}
                trackColor={{ false: colors.border, true: colors.primary + '66' }}
                thumbColor={notificationVisible ? colors.primary : colors.textTertiary}
              />
            </View>
            <Text style={styles.hint}>
              {notificationVisible
                ? 'La notificación aparece en la barra de estado y pantalla de bloqueo. Podés ocultarla si preferís que no se vea, sin afectar el conteo de pasos.'
                : 'La notificación está oculta. El contador de pasos sigue funcionando en segundo plano normalmente.'}
            </Text>

            {notificationVisible && Platform.OS === 'android' && (
              <TouchableOpacity
                style={styles.settingsLink}
                onPress={() => Linking.openSettings()}
                activeOpacity={0.7}
              >
                <Ionicons name="settings-outline" size={16} color={colors.primary} />
                <Text style={styles.settingsLinkText}>
                  ¿No se ve en la pantalla de bloqueo? Revisá los permisos de notificación del sistema
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CUENTA</Text>
          <TouchableOpacity
            style={styles.dangerRow}
            onPress={confirmDeleteAccount}
            activeOpacity={0.75}
          >
            <View style={[styles.rowIcon, { backgroundColor: colors.danger + '22' }]}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </View>
            <View style={styles.rowBody}>
              <Text style={[styles.rowTitle, { color: colors.danger }]}>Eliminar cuenta</Text>
              <Text style={styles.rowSub}>Borra tu cuenta y todos tus datos permanentemente</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !deleting && setDeleteModalVisible(false)}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirmá tu contraseña</Text>
            <Text style={styles.modalSub}>
              Por seguridad, ingresá tu contraseña para eliminar tu cuenta definitivamente.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Contraseña"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry
              value={deletePassword}
              onChangeText={setDeletePassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!deleting}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setDeleteModalVisible(false); setDeletePassword(''); }}
                disabled={deleting}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalDeleteBtn, (!deletePassword || deleting) && { opacity: 0.5 }]}
                onPress={handleDeleteAccount}
                disabled={!deletePassword || deleting}
              >
                {deleting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.modalDeleteText}>Eliminar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
      flexDirection:     'row',
      alignItems:        'center',
      justifyContent:    'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical:   spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    backBtn: {
      width:          40,
      height:         40,
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
      flexDirection:   'row',
      alignItems:      'center',
      backgroundColor: colors.surface,
      borderRadius:    radius.lg,
      padding:         spacing.md,
      gap:             spacing.md,
    },
    dangerRow: {
      flexDirection:   'row',
      alignItems:      'center',
      backgroundColor: colors.surface,
      borderRadius:    radius.lg,
      padding:         spacing.md,
      gap:             spacing.md,
      borderWidth:     1,
      borderColor:     colors.danger + '33',
    },
    rowIcon: {
      width:           36,
      height:          36,
      borderRadius:    18,
      backgroundColor: colors.primary + '22',
      alignItems:      'center',
      justifyContent:  'center',
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
    settingsLink: {
      flexDirection:   'row',
      alignItems:      'center',
      gap:             spacing.sm,
      backgroundColor: colors.surface,
      borderRadius:    radius.lg,
      padding:         spacing.md,
      marginTop:       spacing.sm,
    },
    settingsLinkText: {
      ...typography.caption,
      color:      colors.text,
      flex:       1,
      lineHeight: 18,
    },
    modalBackdrop: {
      flex:            1,
      backgroundColor: colors.overlayMedium,
      alignItems:      'center',
      justifyContent:  'center',
      padding:         spacing.xl,
    },
    modalCard: {
      width:           '100%',
      backgroundColor: colors.surfaceElevated,
      borderRadius:    radius.xl,
      padding:         spacing.xl,
    },
    modalTitle: {
      ...typography.h3,
      color:        colors.text,
      marginBottom: spacing.sm,
    },
    modalSub: {
      ...typography.caption,
      color:        colors.textSecondary,
      lineHeight:   18,
      marginBottom: spacing.lg,
    },
    modalInput: {
      borderWidth:       1,
      borderColor:       colors.border,
      borderRadius:       radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical:   spacing.sm + 2,
      color:             colors.text,
      fontSize:          typography.sizes.base,
      marginBottom:      spacing.lg,
    },
    modalActions: {
      flexDirection: 'row',
      gap:           spacing.md,
    },
    modalCancelBtn: {
      flex:           1,
      paddingVertical: spacing.sm + 4,
      borderRadius:    radius.lg,
      alignItems:      'center',
      backgroundColor: colors.surface,
    },
    modalCancelText: {
      ...typography.body,
      color:      colors.text,
      fontWeight: '600',
    },
    modalDeleteBtn: {
      flex:            1,
      paddingVertical: spacing.sm + 4,
      borderRadius:    radius.lg,
      alignItems:      'center',
      backgroundColor: colors.danger,
    },
    modalDeleteText: {
      ...typography.body,
      color:      '#fff',
      fontWeight: '700',
    },
  });
}
