import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import useAuth from '../hooks/useAuth';
import { typography, spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';

export default function LoginScreen({ navigation }) {
  const { theme: { colors } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { signIn, authLoading, authError, clearAuthError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  const [resetModal, setResetModal]     = useState(false);
  const [resetEmail, setResetEmail]     = useState('');
  const [resetSent,  setResetSent]      = useState(false);
  const [resetError, setResetError]     = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  async function handleReset() {
    if (!resetEmail.trim()) { setResetError('Ingresá tu email.'); return; }
    setResetLoading(true);
    setResetError('');
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim().toLowerCase());
      setResetSent(true);
    } catch (e) {
      const code = e?.code ?? '';
      if (code === 'auth/user-not-found' || code === 'auth/invalid-email') {
        setResetError('No encontramos esa cuenta. Verificá el email.');
      } else if (code === 'auth/network-request-failed') {
        setResetError('Sin conexión. Verificá tu internet e intentá de nuevo.');
      } else if (code === 'auth/too-many-requests') {
        setResetError('Demasiados intentos. Esperá unos minutos.');
      } else {
        setResetError('Error al enviar el email. Intentá de nuevo.');
      }
    } finally {
      setResetLoading(false);
    }
  }

  function closeReset() {
    setResetModal(false);
    setResetEmail('');
    setResetSent(false);
    setResetError('');
  }

  async function handleLogin() {
    setLocalError('');
    clearAuthError();
    if (!email.trim()) { setLocalError('Ingresá tu email.'); return; }
    if (!password) { setLocalError('Ingresá tu contraseña.'); return; }
    try {
      await signIn(email.trim().toLowerCase(), password);
    } catch {
      // El error queda en authError del contexto
    }
  }

  const displayError = localError || authError;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand */}
          <View style={styles.brand}>
            <View style={styles.brandDot} />
            <Text style={styles.brandName}>New Life</Text>
          </View>

          <Text style={styles.title}>Bienvenido de vuelta</Text>
          <Text style={styles.subtitle}>Iniciá sesión para continuar tu progreso.</Text>

          <Field
            label="Email"
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            placeholder="correo@ejemplo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />

          <Field
            label="Contraseña"
            icon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            placeholder="Tu contraseña"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            rightSlot={
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textTertiary}
                />
              </TouchableOpacity>
            }
          />

          {/* Olvidé mi contraseña */}
          <TouchableOpacity
            style={styles.forgotRow}
            onPress={() => { setResetEmail(email); setResetModal(true); }}
            activeOpacity={0.7}
          >
            <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          {!!displayError && <ErrorBox message={displayError} />}

          <TouchableOpacity
            style={[styles.submitBtn, authLoading && styles.submitLoading]}
            onPress={handleLogin}
            activeOpacity={0.82}
            disabled={authLoading}
          >
            {authLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitText}>Iniciar sesión</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => { clearAuthError(); setLocalError(''); navigation.navigate('Register'); }}
            activeOpacity={0.7}
          >
            <Text style={styles.linkText}>
              ¿No tenés cuenta?{'  '}
              <Text style={styles.linkAccent}>Registrate</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal recuperar contraseña */}
      <Modal visible={resetModal} transparent animationType="fade" onRequestClose={closeReset}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeReset}>
          <TouchableOpacity style={styles.modalCard} activeOpacity={1} onPress={() => {}}>
            {resetSent ? (
              <>
                <View style={styles.modalIconWrap}>
                  <Ionicons name="checkmark-circle" size={48} color={colors.primary} />
                </View>
                <Text style={styles.modalTitle}>Email enviado</Text>
                <Text style={styles.modalBody}>
                  Te mandamos un link a{' '}
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>{resetEmail}</Text>
                  {' '}para restablecer tu contraseña.{'\n\n'}
                  Si no lo ves en unos minutos, revisá la carpeta de <Text style={{ fontWeight: '700', color: colors.text }}>Spam</Text>.
                </Text>
                <TouchableOpacity style={styles.modalBtn} onPress={closeReset}>
                  <Text style={styles.modalBtnText}>Entendido</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>Recuperar contraseña</Text>
                <Text style={styles.modalBody}>
                  Ingresá tu email y te enviamos un link para crear una nueva contraseña.
                </Text>
                <View style={[styles.inputBox, { marginBottom: spacing.sm }]}>
                  <Ionicons name="mail-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputText}
                    value={resetEmail}
                    onChangeText={v => { setResetEmail(v); setResetError(''); }}
                    placeholder="correo@ejemplo.com"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                {!!resetError && (
                  <Text style={styles.resetError}>{resetError}</Text>
                )}
                <TouchableOpacity
                  style={[styles.modalBtn, resetLoading && { opacity: 0.7 }]}
                  onPress={handleReset}
                  disabled={resetLoading}
                >
                  {resetLoading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.modalBtnText}>Enviar link</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity onPress={closeReset} style={{ marginTop: spacing.sm }}>
                  <Text style={[styles.linkText, { textAlign: 'center' }]}>Cancelar</Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ── Componentes internos ─────────────────────────────────────────────────────

// El focused state vive acá adentro: nunca re-renderiza el padre al hacer foco.
function Field({ label, icon, rightSlot, containerStyle, ...inputProps }) {
  const { theme: { colors } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.fieldWrap, containerStyle]}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputBox, focused && styles.inputBoxFocused]}>
        {!!icon && (
          <Ionicons
            name={icon}
            size={18}
            color={focused ? colors.primaryDim : colors.textTertiary}
            style={styles.inputIcon}
          />
        )}
        <TextInput
          style={styles.inputText}
          placeholderTextColor={colors.textTertiary}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...inputProps}
        />
        {!!rightSlot && <View style={styles.rightSlot}>{rightSlot}</View>}
      </View>
    </View>
  );
}

function ErrorBox({ message }) {
  const { theme: { colors } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.errorBox}>
      <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────────

function makeStyles(colors) { return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  kav: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing['4xl'],
    paddingBottom: spacing['4xl'],
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 48,
  },
  brandDot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.9,
    shadowRadius: 10,
  },
  brandName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.black,
    color: colors.primary,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.black,
    color: colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    marginBottom: spacing['3xl'],
    lineHeight: 22,
  },
  fieldWrap: { marginBottom: spacing.lg },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: 7,
    letterSpacing: 0.1,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  inputBoxFocused: {
    borderColor: colors.primaryDim,
    backgroundColor: colors.surfaceContainerHigh,
  },
  inputIcon: { marginRight: 10 },
  inputText: {
    flex: 1,
    fontSize: typography.sizes.base,
    color: colors.text,
    paddingVertical: 14,
  },
  rightSlot: { marginLeft: 8 },
  forgotRow: { alignItems: 'flex-end', marginBottom: spacing.lg, marginTop: -spacing.sm },
  forgotText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.dangerDim,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.danger,
    lineHeight: 18,
  },
  submitBtn: {
    backgroundColor: colors.primaryDim,
    borderRadius: radius.full,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
    marginBottom: spacing.xl,
  },
  submitLoading: { opacity: 0.7 },
  submitText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: '#fff',
    letterSpacing: 0.3,
  },
  linkRow: { alignItems: 'center', paddingVertical: spacing.sm },
  linkText: { fontSize: typography.sizes.sm, color: colors.textSecondary },
  linkAccent: { color: colors.primary, fontWeight: typography.weights.bold },

  // Modal recuperar contraseña
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing['2xl'],
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing['2xl'],
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  modalIconWrap: { alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.black,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  modalBody: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  resetError: {
    fontSize: typography.sizes.sm,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  modalBtn: {
    backgroundColor: colors.primaryDim,
    borderRadius: radius.full,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
    marginTop: spacing.sm,
  },
  modalBtnText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: '#fff',
  },
}); }
