import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { typography, spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';
import useAuth from '../hooks/useAuth';
import { subscribeTorneosForUser, createTorneo, tiempoRestante } from '../services/torneoService';

export default function TorneosScreen({ navigation }) {
  const { theme: { colors } } = useTheme();
  const { user } = useAuth();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [torneos, setTorneos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [nombre, setNombre] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeTorneosForUser(user.uid, data => {
      setTorneos(data);
      setLoading(false);
    });
    return unsub;
  }, [user?.uid]);

  const handleCreate = useCallback(async () => {
    if (!nombre.trim() || creating) return;
    setCreating(true);
    try {
      const id = await createTorneo({ nombre, creadoPor: user.uid });
      setModalVisible(false);
      setNombre('');
      navigation.navigate('TorneoDetail', { torneoId: id, nombre: nombre.trim() });
    } catch {}
    setCreating(false);
  }, [nombre, creating, user?.uid, navigation]);

  const renderItem = useCallback(({ item }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
      onPress={() => navigation.navigate('TorneoDetail', { torneoId: item.id, nombre: item.nombre })}
      activeOpacity={0.8}
    >
      <View style={[styles.cardIconWrap, { backgroundColor: '#FBBF2415', borderWidth: 1, borderColor: '#FBBF2440' }]}>
        <Ionicons name="trophy" size={20} color="#FBBF24" />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardRow}>
          <Text style={[styles.cardNombre, { color: colors.text }]} numberOfLines={1}>{item.nombre}</Text>
          {item.activo && (
            <View style={[styles.activoBadge, { backgroundColor: '#22C55E20', borderColor: '#22C55E40' }]}>
              <Text style={styles.activoText}>Activo</Text>
            </View>
          )}
        </View>
        <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
          Por {item.creadoPorNombre || 'Desconocido'} · {(item.participantUids ?? []).length} participantes
        </Text>
        {item.fechaFin && (() => {
          const t = tiempoRestante(item.fechaFin);
          return (
            <Text style={[styles.cardTimer, { color: t.vencido ? '#EF4444' : colors.textTertiary }]}>
              {t.vencido ? '⏱ Terminado' : `⏱ ${t.texto}`}
            </Text>
          );
        })()}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </TouchableOpacity>
  ), [colors, navigation]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]} edges={['top']}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Torneos</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={20} color="#000" />
        </TouchableOpacity>
      </View>

      {torneos.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconWrap, { backgroundColor: '#FBBF2415', borderColor: '#FBBF2440' }]}>
            <Ionicons name="trophy" size={40} color="#FBBF24" />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Creá tu primer torneo</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
            Desafiá a tus amigos y mirá quién sube más de nivel
          </Text>
          <TouchableOpacity
            style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="trophy-outline" size={18} color="#000" />
            <Text style={styles.emptyBtnText}>Crear torneo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={torneos}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheetWrapper}
        >
          <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Nuevo torneo</Text>
            <Text style={[styles.sheetLabel, { color: colors.textSecondary }]}>Nombre del torneo</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.text }]}
              placeholder="Ej: Liga de agosto"
              placeholderTextColor={colors.textTertiary}
              value={nombre}
              onChangeText={setNombre}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
            <TouchableOpacity
              style={[styles.createBtn, { backgroundColor: colors.primary, opacity: nombre.trim() ? 1 : 0.5 }]}
              onPress={handleCreate}
              disabled={!nombre.trim() || creating}
              activeOpacity={0.85}
            >
              {creating
                ? <ActivityIndicator size="small" color="#000" />
                : <Text style={styles.createBtnText}>Crear</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 0.5,
    },
    backBtn: { padding: 4, marginRight: spacing.sm },
    headerTitle: {
      flex: 1,
      fontSize: typography.sizes.xl,
      fontWeight: typography.weights.black,
    },
    addBtn: {
      width: 34,
      height: 34,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    list: {
      padding: spacing.xl,
      gap: spacing.sm,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: radius.lg,
      borderWidth: 0.5,
      padding: spacing.md,
      gap: spacing.md,
    },
    cardIconWrap: {
      width: 42,
      height: 42,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    cardBody: { flex: 1 },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 3 },
    cardNombre: {
      flex: 1,
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.bold,
    },
    activoBadge: {
      borderWidth: 1,
      borderRadius: radius.full,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    activoText: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold,
      color: '#22C55E',
    },
    cardSub: {
      fontSize: typography.sizes.sm,
    },
    cardTimer: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.medium,
      marginTop: 2,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing['2xl'],
    },
    emptyIconWrap: {
      width: 80,
      height: 80,
      borderRadius: radius.xl,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xl,
    },
    emptyTitle: {
      fontSize: typography.sizes['2xl'],
      fontWeight: typography.weights.black,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    emptySub: {
      fontSize: typography.sizes.base,
      textAlign: 'center',
      lineHeight: typography.sizes.base * 1.5,
      marginBottom: spacing['2xl'],
    },
    emptyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing['2xl'],
      paddingVertical: spacing.md,
      borderRadius: radius.full,
    },
    emptyBtnText: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.bold,
      color: '#000',
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheetWrapper: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
    },
    sheet: {
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      borderWidth: 0.5,
      borderBottomWidth: 0,
      padding: spacing.xl,
      paddingBottom: spacing['3xl'],
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: radius.full,
      alignSelf: 'center',
      marginBottom: spacing.xl,
    },
    sheetTitle: {
      fontSize: typography.sizes.xl,
      fontWeight: typography.weights.black,
      marginBottom: spacing.xl,
    },
    sheetLabel: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
      marginBottom: spacing.sm,
    },
    input: {
      borderWidth: 1,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: typography.sizes.base,
      marginBottom: spacing.xl,
    },
    createBtn: {
      borderRadius: radius.full,
      paddingVertical: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    createBtnText: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.bold,
      color: '#000',
    },
  });
}
