import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { typography, spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { user, productos } from '../constants/mockData';

export default function TiendaScreen() {
  const { theme: { colors } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [coins, setCoins] = useState(user.coins);
  const [confirmModal, setConfirmModal] = useState(null);
  const [successModal, setSuccessModal] = useState(null);

  const handleCanjear = (producto) => {
    if (coins < producto.price) return;
    setConfirmModal(producto);
  };

  const confirmarCanje = () => {
    setCoins((c) => c - confirmModal.price);
    setSuccessModal(confirmModal);
    setConfirmModal(null);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.logo}>New Life</Text>
          <TouchableOpacity style={styles.historyBtn}>
            <Ionicons name="receipt-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ── Saldo ── */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>SALDO DISPONIBLE</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceCoin}>🪙</Text>
            <Text style={styles.balanceAmount}>{coins.toLocaleString('es-AR')}</Text>
          </View>
          <Text style={styles.balanceHint}>
            Ganás monedas entrenando, caminando y completando misiones
          </Text>
        </View>

        {/* ── Catálogo ── */}
        <Text style={styles.sectionTitle}>Catálogo de Premios</Text>
        <View style={styles.productList}>
          {productos.map((producto) => (
            <ProductCard
              key={producto.id}
              producto={producto}
              userCoins={coins}
              onCanjear={() => handleCanjear(producto)}
            />
          ))}
        </View>

        <View style={{ height: spacing['2xl'] }} />
      </ScrollView>

      {/* ── Modal confirmación ── */}
      <Modal
        visible={!!confirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModal(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setConfirmModal(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {confirmModal?.image && (
              <Image
                source={{ uri: confirmModal.image }}
                style={styles.modalProductImage}
              />
            )}
            <Text style={styles.modalTitle}>¿Canjear recompensa?</Text>
            <Text style={styles.modalProduct}>{confirmModal?.title}</Text>
            <View style={styles.modalSeparator} />
            <View style={styles.modalRow}>
              <Text style={styles.modalRowLabel}>Costo</Text>
              <Text style={styles.modalRowValue}>🪙 {confirmModal?.price}</Text>
            </View>
            <View style={styles.modalRow}>
              <Text style={styles.modalRowLabel}>Saldo restante</Text>
              <Text style={[styles.modalRowValue, { color: colors.primary }]}>
                🪙 {coins - (confirmModal?.price ?? 0)}
              </Text>
            </View>
            <View style={styles.modalSeparator} />
            <TouchableOpacity style={styles.confirmBtn} onPress={confirmarCanje}>
              <Text style={styles.confirmBtnText}>Confirmar canje</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmModal(null)}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Modal éxito ── */}
      <Modal
        visible={!!successModal}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessModal(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSuccessModal(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark" size={40} color={colors.textInverse} />
            </View>
            <Text style={styles.successTitle}>¡Canje exitoso!</Text>
            <Text style={styles.successProduct}>{successModal?.title}</Text>
            <Text style={styles.successHint}>
              Presentá este mensaje en recepción para retirar tu recompensa.
            </Text>
            <TouchableOpacity style={styles.confirmBtn} onPress={() => setSuccessModal(null)}>
              <Text style={styles.confirmBtnText}>Perfecto</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function ProductCard({ producto, userCoins, onCanjear }) {
  const { theme: { colors } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const canAfford = userCoins >= producto.price;

  return (
    <View style={styles.productCard}>
      <Image
        source={{ uri: producto.image }}
        style={styles.productImage}
        resizeMode="cover"
      />
      {producto.featured && (
        <View style={styles.featuredBadge}>
          <Text style={styles.featuredBadgeText}>DESTACADO</Text>
        </View>
      )}

      <View style={styles.productInfo}>
        <View style={styles.productRow}>
          <View style={styles.productTexts}>
            <Text style={styles.productName}>{producto.title}</Text>
            <Text style={styles.productDesc} numberOfLines={2}>
              {producto.description}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.canjearBtn, !canAfford && styles.canjearBtnDisabled]}
            onPress={onCanjear}
            disabled={!canAfford}
            activeOpacity={0.85}
          >
            <Text style={[styles.canjearBtnText, !canAfford && styles.canjearBtnTextDisabled]}>
              {canAfford ? 'Canjear' : 'Sin saldo'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.priceRow}>
          <View style={styles.priceChip}>
            <Text style={styles.priceCoinIcon}>🪙</Text>
            <Text style={styles.priceValue}>{producto.price}</Text>
          </View>
          {!canAfford && (
            <Text style={styles.shortfall}>
              Faltan 🪙 {producto.price - userCoins}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

function makeStyles(colors) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing['3xl'] },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  logo: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.black,
    color: colors.primary,
    letterSpacing: -0.5,
  },
  historyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },

  // Balance
  balanceCard: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  balanceLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.textSecondary,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  balanceCoin: { fontSize: 30 },
  balanceAmount: {
    fontSize: 42,
    fontWeight: typography.weights.black,
    color: colors.text,
    letterSpacing: -1,
  },
  balanceHint: {
    fontSize: typography.sizes.xs,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: typography.sizes.xs * 1.6,
  },

  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  productList: { gap: spacing.md },

  // Product card
  productCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: 160,
    backgroundColor: colors.surfaceContainerHigh,
  },
  featuredBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  featuredBadgeText: {
    fontSize: 10,
    fontWeight: typography.weights.black,
    color: colors.textInverse,
    letterSpacing: 0.5,
  },
  productInfo: { padding: spacing.md },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  productTexts: { flex: 1 },
  productName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 3,
  },
  productDesc: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: typography.sizes.sm * 1.4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.coinDim,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
    gap: 4,
  },
  priceCoinIcon: { fontSize: 13 },
  priceValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.black,
    color: colors.coin,
  },
  shortfall: {
    fontSize: typography.sizes.xs,
    color: colors.textTertiary,
  },

  canjearBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 9,
    paddingHorizontal: spacing.lg,
    flexShrink: 0,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  canjearBtnDisabled: {
    backgroundColor: colors.surfaceContainerHigh,
    shadowOpacity: 0,
    elevation: 0,
  },
  canjearBtnText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.textInverse,
  },
  canjearBtnTextDisabled: {
    color: colors.textTertiary,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing['2xl'],
    width: '100%',
    alignItems: 'center',
  },
  modalProductImage: {
    width: '100%',
    height: 140,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.black,
    color: colors.text,
    marginBottom: 4,
  },
  modalProduct: {
    fontSize: typography.sizes.base,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.lg,
  },
  modalSeparator: {
    height: 1,
    backgroundColor: colors.borderLight,
    width: '100%',
    marginVertical: spacing.sm,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: spacing.sm,
  },
  modalRowLabel: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
  },
  modalRowValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  confirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  confirmBtnText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.textInverse,
  },
  cancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    width: '100%',
  },
  cancelBtnText: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
  },

  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  successTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.black,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  successProduct: {
    fontSize: typography.sizes.md,
    color: colors.text,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
  },
  successHint: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.sizes.sm * 1.55,
    marginBottom: spacing.xl,
  },
}); }
