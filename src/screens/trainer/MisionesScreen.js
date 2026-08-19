import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, Modal, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { typography, spacing, radius } from '../../theme';
import useDailyMissions from '../../hooks/useDailyMissions';
import { addMission, deleteMission } from '../../services/misionesService';

const ICON_OPTIONS = [
  { key: 'footsteps-outline',  label: 'Pasos' },
  { key: 'barbell-outline',    label: 'Pesas' },
  { key: 'water-outline',      label: 'Agua' },
  { key: 'moon-outline',       label: 'Sueño' },
  { key: 'nutrition-outline',  label: 'Dieta' },
  { key: 'bicycle-outline',    label: 'Cardio' },
  { key: 'flame-outline',      label: 'Intenso' },
  { key: 'heart-outline',      label: 'Salud' },
  { key: 'timer-outline',      label: 'Tiempo' },
  { key: 'walk-outline',       label: 'Caminar' },
  { key: 'sunny-outline',      label: 'Mañana' },
  { key: 'trophy-outline',     label: 'Logro' },
];

export default function MisionesScreen({ navigation }) {
  const { theme: { colors } } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { missions, loading } = useDailyMissions();

  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle]   = useState('');
  const [xp, setXp]         = useState('');
  const [icon, setIcon]     = useState('barbell-outline');
  const [saving, setSaving] = useState(false);

  const screenOpacity = useSharedValue(0);
  const screenStyle   = useAnimatedStyle(() => ({ flex: 1, opacity: screenOpacity.value }));
  useEffect(() => { screenOpacity.value = withTiming(1, { duration: 280 }); }, []);

  const openModal = useCallback(() => {
    setTitle('');
    setXp('');
    setIcon('barbell-outline');
    setModalVisible(true);
  }, []);

  const handleAdd = useCallback(async () => {
    const t = title.trim();
    if (!t) { Alert.alert('Falta el nombre', 'Escribí una descripción para la misión.'); return; }
    const xpNum = parseInt(xp, 10);
    if (!xpNum || xpNum < 1) { Alert.alert('XP inválido', 'Ingresá un número mayor a 0.'); return; }
    setSaving(true);
    try {
      await addMission({ title: t, xp: xpNum, icon });
      setModalVisible(false);
    } catch {
      Alert.alert('Error', 'No se pudo guardar la misión. Intentá de nuevo.');
    } finally {
      setSaving(false);
    }
  }, [title, xp, icon]);

  const handleDelete = useCallback((mission) => {
    Alert.alert(
      'Eliminar misión',
      `¿Eliminás "${mission.title}"? Los clientes ya no la verán.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try { await deleteMission(mission.id); }
            catch { Alert.alert('Error', 'No se pudo eliminar la misión.'); }
          },
        },
      ]
    );
  }, []);

  const canSave = title.trim().length > 0 && parseInt(xp, 10) > 0;

  return (
    <Animated.View style={screenStyle}>
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Misiones Diarias</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{missions.length}</Text>
        </View>
      </View>

      {/* Subtitle */}
      <Text style={styles.subtitle}>
        Estas misiones son visibles para todos tus clientes.
      </Text>

      {/* List */}
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={missions}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="checkmark-circle-outline" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyText}>Sin misiones todavía</Text>
              <Text style={styles.emptySub}>Agregá la primera con el botón de abajo.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <MisionRow
              mission={item}
              colors={colors}
              styles={styles}
              onDelete={() => handleDelete(item)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* Add button */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={openModal} activeOpacity={0.82}>
          <Ionicons name="add" size={20} color={colors.textInverse} />
          <Text style={[styles.addBtnText, { color: colors.textInverse }]}>Agregar misión</Text>
        </TouchableOpacity>
      </View>

      {/* Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          />
          <View style={[styles.modalSheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>Nueva Misión</Text>

            {/* Mission title */}
            <Text style={[styles.label, { color: colors.textSecondary }]}>Descripción</Text>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              value={title}
              onChangeText={setTitle}
              placeholder="Ej: Caminar 30 minutos"
              placeholderTextColor={colors.textTertiary}
              maxLength={60}
              returnKeyType="next"
            />

            {/* XP + Coins row */}
            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>XP</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                  value={xp}
                  onChangeText={setXp}
                  placeholder="10"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>
            </View>

            {/* Icon picker */}
            <Text style={[styles.label, { color: colors.textSecondary }]}>Ícono</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconScroll}>
              {ICON_OPTIONS.map(opt => {
                const selected = icon === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.iconBtn,
                      { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.surfaceElevated },
                    ]}
                    onPress={() => setIcon(opt.key)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name={opt.key} size={22} color={selected ? '#fff' : colors.textTertiary} />
                    <Text style={[styles.iconLabel, { color: selected ? '#fff' : colors.textTertiary }]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setModalVisible(false)}
                activeOpacity={0.75}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary }, !canSave && { opacity: 0.4 }]}
                onPress={handleAdd}
                disabled={!canSave || saving}
                activeOpacity={0.82}
              >
                {saving ? (
                  <ActivityIndicator color={colors.textInverse} />
                ) : (
                  <Text style={[styles.saveBtnText, { color: colors.textInverse }]}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
    </Animated.View>
  );
}

function MisionRow({ mission, colors, styles, onDelete }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.primaryDim12 }]}>
        <Ionicons name={mission.icon ?? 'checkmark-circle-outline'} size={20} color={colors.primary} />
      </View>
      <View style={styles.cardContent}>
        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>{mission.title}</Text>
        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: colors.primaryDim12 }]}>
            <Text style={[styles.badgeText, { color: colors.primary }]}>+{mission.xp} XP</Text>
          </View>
        </View>
      </View>
      <TouchableOpacity style={styles.deleteBtn} onPress={onDelete} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="trash-outline" size={18} color="#EF4444" />
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(colors) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  countBadge: {
    width: 40,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },

  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
  },

  list: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['3xl'],
    flexGrow: 1,
  },
  separator: { height: spacing.sm },

  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  emptySub: {
    fontSize: typography.sizes.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 0.5,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardContent: { flex: 1, gap: 6 },
  cardTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  badges: { flexDirection: 'row', gap: spacing.sm },
  badge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  deleteBtn: {
    padding: spacing.sm,
  },

  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  addBtnText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 0.5,
    paddingHorizontal: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? spacing['3xl'] : spacing.xl,
    paddingTop: spacing.lg,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    marginBottom: 6,
    marginTop: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.base,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfField: { flex: 1 },

  iconScroll: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  iconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    marginRight: spacing.sm,
    gap: 4,
  },
  iconLabel: {
    fontSize: 10,
    fontWeight: typography.weights.medium,
  },

  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
  },
  saveBtn: {
    flex: 2,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
}); }