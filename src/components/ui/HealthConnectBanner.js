import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HC_STATUS } from '../../services/stepService';
import { spacing, typography, radius } from '../../theme';

export default function HealthConnectBanner({ hcStatus, onInstall, colors }) {
  if (hcStatus === HC_STATUS.NOT_ANDROID || hcStatus === HC_STATUS.AVAILABLE || hcStatus === HC_STATUS.UNKNOWN) {
    return null;
  }

  const isUpdate = hcStatus === HC_STATUS.NEEDS_UPDATE;

  return (
    <View style={[styles.banner, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.primaryDim12 }]}>
        <Ionicons name="footsteps-outline" size={20} color={colors.primary} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.text }]}>
          {isUpdate ? 'Actualizá Health Connect' : 'Mejorá el contador de pasos'}
        </Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          {isUpdate
            ? 'Una actualización de Health Connect está disponible para mejorar la precisión.'
            : 'Con Health Connect contamos los pasos desde las 00:00, aunque no hayas abierto la app.'}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: colors.primary }]}
        onPress={onInstall}
        activeOpacity={0.8}
      >
        <Text style={[styles.btnText, { color: colors.textInverse }]}>
          {isUpdate ? 'Actualizar' : 'Instalar'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            spacing.md,
    marginHorizontal: spacing.xl,
    marginBottom:   spacing.lg,
    padding:        spacing.md,
    borderRadius:   radius.lg,
    borderWidth:    0.5,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  body:    { flex: 1, gap: 2 },
  title:   { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },
  sub:     { fontSize: typography.sizes.xs, lineHeight: typography.sizes.xs * 1.5 },
  btn: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    borderRadius:      radius.md,
    flexShrink: 0,
  },
  btnText: { fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold },
});